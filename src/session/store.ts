import { createEmptyDailyRecord, sumCarbonEstimates, sumMetrics } from "./aggregator";
import { normalizeDailyRecords } from "./legacy";
import type { DailyRecord, DailyRecordsStore, MetricTab, MetricsStore } from "./types";
import type { DailyRecordsStorage } from "../storage/types";
import { KEEP_EVERYTHING, isKept } from "../config/retention";
import type { Clock } from "../utils/clock";

function rebuildTotals(record: DailyRecord): DailyRecord {
  return {
    ...record,
    totalMetrics: sumMetrics(record.tabs.map((tab) => tab.metrics)),
    totalCarbon: sumCarbonEstimates(record.tabs.map((tab) => tab.carbon)),
  };
}

/**
 * Replaces the measurements of a tab already recorded today, or appends it.
 *
 * The identity fields (`url`, `domain`) deliberately stay as first observed:
 * today's unit of measurement is the browser tab, not the navigation. Moving to
 * one entry per navigation keys this function on `(tabId, timeOrigin, url)` and
 * makes appending the default case — replacing only routes a delta onto a visit
 * already known. It is therefore not the one-line change an earlier note here
 * claimed.
 * See docs/decisions/2026-08-21-identite-de-la-visite-de-page.md
 *
 * O(n) time, O(n) space — n = tabs recorded today.
 */
function upsertTab(tabs: MetricTab[], incoming: MetricTab): MetricTab[] {
  let replaced = false;
  const merged = tabs.map((tab) => {
    if (tab.id !== incoming.id) return tab;
    replaced = true;
    return { ...tab, metrics: incoming.metrics, carbon: incoming.carbon, meta: incoming.meta };
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

    recordTabMetrics: (tab: MetricTab): Promise<void> =>
      mutateToday((record) => rebuildTotals({ ...record, tabs: upsertTab(record.tabs, tab) })),

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
