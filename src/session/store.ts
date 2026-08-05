import { emptyDailyRecord, sumCarbonEstimates, sumMetrics } from "./aggregator";
import type { DailyRecord, MetricTab, MetricsStore } from "./types";
import type { DailyRecordsStorage } from "../storage/types";
import type { Clock } from "../utils/clock";
import { toDailyDate } from "../utils/clock";

/** `retentionDays` sentinel meaning "never drop a day". */
const RETENTION_KEEP_EVERYTHING = -1;

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
 * one entry per navigation means keying this function on `(id, url)` — that
 * single comparison, and nothing else in the module.
 * See docs/decisions/2026-08-05-page-visit-unite-de-mesure.md
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

  async function readToday(): Promise<DailyRecord> {
    const date = clock.dailyDate();
    if (cached !== undefined && cached.date === date) return cached.record;
    const sessions = await storage.getSessions();
    const record = sessions[date] ?? emptyDailyRecord(date);
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
      const date = clock.dailyDate();
      const sessions = await storage.getSessions();
      const updated = change(sessions[date] ?? emptyDailyRecord(date));
      await storage.setSessions({ ...sessions, [date]: updated });
      // Warm rather than invalidate — saves a storage round-trip on the next read
      cached = { date, record: updated };
    });
  }

  return {
    getDailyRecord: (): Promise<DailyRecord> => readToday(),

    getAllDays: async (): Promise<DailyRecord[]> => {
      const sessions = await storage.getSessions();
      return Object.values(sessions).sort((a, b) => a.date.localeCompare(b.date));
    },

    recordTabMetrics: (tab: MetricTab): Promise<void> =>
      mutateToday((record) => rebuildTotals({ ...record, tabs: upsertTab(record.tabs, tab) })),

    clearPastDays: (retentionDays: number): Promise<void> => {
      if (retentionDays === RETENTION_KEEP_EVERYTHING) return Promise.resolve();
      return enqueue(async () => {
        const sessions = await storage.getSessions();
        const today = clock.dailyDate();
        const cutoffDate = clock.now();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoff = toDailyDate(cutoffDate);
        const kept = Object.fromEntries(
          Object.entries(sessions).filter(([date]) => date >= cutoff || date === today),
        );
        await storage.setSessions(kept);
        cached = undefined;
      });
    },
  };
}
