import { createEmptyDailyRecord, sumCarbonEstimates, sumMetrics } from "./aggregator";
import { normalizeDailyRecords } from "./legacy";
import type { DailyRecord, DailyRecordsStore, PageVisit, MetricsStore } from "./types";
import type { DailyRecordsStorage } from "../storage/types";
import { KEEP_EVERYTHING, isKept } from "../config/retention";
import type { Clock } from "../utils/clock";

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
 * **Appending is the default case.** The key is `(tabId, meta.date, url)`: two
 * reloads are two documents and two visits, and replacing them would under-count
 * bytes that really crossed the network. Replacement survives only to route a
 * later measurement — a living-record delta — onto a visit already known, which
 * is exactly when all three components match.
 * See docs/decisions/2026-08-21-identite-de-la-visite-de-page.md
 *
 * O(n) time, O(n) space — n = visits recorded today.
 */
const isSameVisit = (a: PageVisit, b: PageVisit): boolean =>
  a.tabId === b.tabId && a.meta.date === b.meta.date && a.url === b.url;

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
 * Owns today's daily record: one read-modify-write critical section, one
 * in-memory cache. Constructed rather than ambient, so every test gets its own
 * instance and no reset hook has to be published.
 */
export function createMetricsStore(storage: DailyRecordsStorage, clock: Clock): MetricsStore {
  let cached: { date: string; record: DailyRecord } | undefined;

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
    if (cached !== undefined && cached.date === date) return cached.record;
    const records = await loadRecords();
    const record = records[date] ?? createEmptyDailyRecord(date);
    cached = { date, record };
    return record;
  }

  /**
   * The only path that writes. Reading the day, deciding and persisting all
   * happen inside one `enqueue()` turn — a decision taken outside it could be
   * stale by the time the write lands.
   */
  function mutateToday(change: (record: DailyRecord) => DailyRecord): Promise<void> {
    return enqueue(async () => {
      const date = clock.readDailyDate();
      const records = await loadRecords();
      const updated = change(records[date] ?? createEmptyDailyRecord(date));
      await storage.setSessions({ ...records, [date]: updated });
      // Warm rather than invalidate — saves a storage round-trip on the next read
      cached = { date, record: updated };
    });
  }

  return {
    getDailyRecord: (): Promise<DailyRecord> => readToday(),

    getAllDays: async (): Promise<DailyRecord[]> => {
      const records = await loadRecords();
      return Object.values(records).sort((a, b) => a.date.localeCompare(b.date));
    },

    recordPageVisit: (visit: PageVisit): Promise<void> =>
      mutateToday((record) =>
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
        cached = undefined;
      });
    },
  };
}
