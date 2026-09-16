import { createEmptyDailyRecord, sumCarbonEstimates, sumMetrics } from "./aggregator";
import { normalizeDailyRecords } from "./legacy";
import type { DailyRecord, DailyRecordsStore, PageVisit, MetricsStore } from "./types";
import type { DailyRecordsStorage } from "../storage/types";
import { KEEP_EVERYTHING, isKept } from "../config/retention";
import type { Clock } from "../utils/clock";
import { toDailyDate } from "../utils/clock";

function rebuildTotals(record: DailyRecord): DailyRecord {
  return {
    ...record,
    totalMetrics: sumMetrics(record.visits.map((visit) => visit.metrics)),
    totalCarbon: sumCarbonEstimates(record.visits.map((visit) => visit.carbon)),
  };
}

/**
 * Appends a visit, or replaces the one carrying the same identity.
 *
 * **Appending is the default case.** The key is
 * `(tabId, meta.date, url, meta.observedFrom)`: two reloads are two documents
 * and two visits, and replacing them would under-count bytes that really crossed
 * the network. Replacement survives only to route a later measurement — a
 * living-record delta — onto a visit already known, which is exactly when all
 * four components match.
 *
 * `observedFrom` is the fourth because a document can be observed twice: a
 * re-injected content script replays a truncated buffer and reports *less*, and
 * on a three-part key that regression overwrote the real total.
 * See docs/decisions/2026-08-21-identite-de-la-visite-de-page.md
 * and docs/decisions/2026-09-16-instance-d-observation.md
 *
 * O(n) time, O(n) space — n = visits recorded today.
 */
const isSameVisit = (a: PageVisit, b: PageVisit): boolean =>
  a.tabId === b.tabId &&
  a.meta.date === b.meta.date &&
  a.url === b.url &&
  a.meta.observedFrom === b.meta.observedFrom;

function upsertVisit(visits: PageVisit[], incoming: PageVisit): PageVisit[] {
  let replaced = false;
  const merged = visits.map((visit) => {
    if (!isSameVisit(visit, incoming)) return visit;
    replaced = true;
    return { ...visit, metrics: incoming.metrics, carbon: incoming.carbon, meta: incoming.meta };
  });
  return replaced ? merged : [...merged, incoming];
}

/**
 * Owns today's daily record: one read-modify-write critical section.
 * Constructed rather than ambient, so every test gets its own instance and no
 * reset hook has to be published.
 *
 * **No in-memory cache.** One used to sit here, warmed on every read and write.
 * It saved a storage round-trip and cost correctness the moment two contexts
 * shared the data: the background writes a delta, the panel's own instance keeps
 * serving the copy it read at mount, and the panel goes quietly stale — which a
 * living record makes visible every five seconds. Every write already re-reads
 * storage inside its queued turn, so the cache only ever spared a read on the
 * badge path.
 * See docs/decisions/2026-09-15-enregistrement-vivant.md
 */
export function createMetricsStore(storage: DailyRecordsStorage, clock: Clock): MetricsStore {
  // Serializes all mutations to prevent concurrent read-modify-write races
  let writeQueue: Promise<void> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = writeQueue.then(task);
    // Prevent a rejected task from stalling subsequent enqueued operations
    writeQueue = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  /**
   * The single door bytes come through. Every record above this line carries the
   * current shape, whichever version wrote it.
   */
  async function loadRecords(): Promise<DailyRecordsStore> {
    return normalizeDailyRecords(await storage.getSessions());
  }

  async function readToday(): Promise<DailyRecord> {
    const date = clock.readDailyDate();
    const records = await loadRecords();
    return records[date] ?? createEmptyDailyRecord(date);
  }

  /**
   * The only path that writes. Reading the day, deciding and persisting all
   * happen inside one `enqueue()` turn — a decision taken outside it could be
   * stale by the time the write lands.
   *
   * A day other than today is only **updated**, never created: a living visit
   * from yesterday keeps reporting after midnight, and if retention has dropped
   * that day in between, recreating it would resurrect what the panel promised
   * to delete for good. Today is created on demand, as it always was.
   */
  function mutateDay(date: string, change: (record: DailyRecord) => DailyRecord): Promise<void> {
    return enqueue(async () => {
      const records = await loadRecords();
      const stored = records[date];
      if (stored === undefined && date !== clock.readDailyDate()) return;

      const updated = change(stored ?? createEmptyDailyRecord(date));
      await storage.setSessions({ ...records, [date]: updated });
    });
  }

  return {
    getDailyRecord: (): Promise<DailyRecord> => readToday(),

    getAllDays: async (): Promise<DailyRecord[]> => {
      const records = await loadRecords();
      return Object.values(records).sort((a, b) => a.date.localeCompare(b.date));
    },

    /**
     * Filed under the day the **visit** began, read from its own timestamp — not
     * under the day the message happens to land on. A page opened at 23:58 and
     * still visible at 00:05 reports cumulative totals: filing those under the
     * new day would count the same bytes twice, once per day.
     */
    recordPageVisit: (visit: PageVisit): Promise<void> =>
      mutateDay(toDailyDate(new Date(visit.meta.date)), (record) =>
        rebuildTotals({ ...record, visits: upsertVisit(record.visits, visit) }),
      ),

    /** O(n) time and space — n = stored days; `isKept` is O(1) per day. */
    clearPastDays: (retentionDays: number): Promise<void> => {
      if (retentionDays === KEEP_EVERYTHING) return Promise.resolve();
      return enqueue(async () => {
        const records = await loadRecords();
        const today = clock.now();
        const kept = Object.fromEntries(
          Object.entries(records).filter(([date]) => isKept(date, retentionDays, today)),
        );
        await storage.setSessions(kept);
      });
    },
  };
}
