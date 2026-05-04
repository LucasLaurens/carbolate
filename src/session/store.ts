import { sumMetrics, sumCarbonEstimates } from "./aggregator";
import { ChromeStorage } from "../storage/ChromeStorage";
import type { DailyRecord, MetricTab, Metrics, MetricsStore } from "./types";
import type { CarbonEstimate } from "../carbon/types";
import { getDailyDate } from "../utils/date";
import { clock } from "../utils/clock";

const emptyMetrics: Metrics = { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 };
const emptyCarbon: CarbonEstimate = { networkCo2: 0, cpuCo2: 0, totalCo2: 0 };

const emptyDailyRecord = (date: string): DailyRecord => ({
  date,
  tabs: [],
  totalMetrics: { ...emptyMetrics },
  totalCarbon: { ...emptyCarbon },
});

// In-memory cache
let cache: DailyRecord | null = null;
let cacheDate: string = "";

// Serializes all mutations to prevent concurrent read-modify-write races
let writeQueue: Promise<void> = Promise.resolve();

export function invalidateCache(): void {
  cache = null;
  cacheDate = "";
}

// Register reset hook for test environments (also resets the write queue)
(globalThis as Record<string, unknown>).__carbolateCacheReset = () => {
  cache = null;
  cacheDate = "";
  writeQueue = Promise.resolve();
};

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task);
  // Prevent a rejected task from stalling subsequent enqueued operations
  writeQueue = result.then(
    () => {},
    () => {},
  );
  return result;
}

async function getCachedDailyRecord(): Promise<DailyRecord | null> {
  const today = getDailyDate();
  if (cache && cacheDate === today) return cache;
  const sessions = await ChromeStorage.getSessions();
  cache = sessions[today] ?? null;
  cacheDate = today;
  return cache;
}

// Single read-modify-write helper — all mutations go through here via enqueue()
async function mutateToday(fn: (record: DailyRecord) => DailyRecord): Promise<void> {
  const date = getDailyDate();
  const sessions = await ChromeStorage.getSessions();
  const current = sessions[date] ?? emptyDailyRecord(date);
  const updated = fn(current);
  await ChromeStorage.setSessions({ ...sessions, [date]: updated });
  // Warm cache instead of just invalidating — avoids an extra storage round-trip on next read
  cache = updated;
  cacheDate = date;
}

function rebuildTotals(record: DailyRecord): DailyRecord {
  return {
    ...record,
    totalMetrics: sumMetrics(record.tabs.map((t) => t.metrics)),
    totalCarbon: sumCarbonEstimates(record.tabs.map((t) => t.carbon)),
  };
}

export const metricsStore: MetricsStore = {
  findDailyRecord: (): Promise<DailyRecord | null> => getCachedDailyRecord(),

  findOrCreateDailyRecord: (): Promise<DailyRecord> =>
    enqueue(async () => {
      const date = getDailyDate();
      const sessions = await ChromeStorage.getSessions();
      if (sessions[date]) {
        cache = sessions[date];
        cacheDate = date;
        return sessions[date];
      }
      const record = emptyDailyRecord(date);
      await ChromeStorage.setSessions({ ...sessions, [date]: record });
      cache = record;
      cacheDate = date;
      return record;
    }),

  getAllDays: async (): Promise<DailyRecord[]> => {
    const sessions = await ChromeStorage.getSessions();
    return Object.values(sessions).sort((a, b) => a.date.localeCompare(b.date));
  },

  hasExistingTabById: async (tabId: number): Promise<boolean> => {
    const record = await getCachedDailyRecord();
    return record?.tabs.some((tab) => tab.id === tabId) ?? false;
  },

  addTab: (tab: MetricTab): Promise<void> =>
    enqueue(() =>
      mutateToday((record) => rebuildTotals({ ...record, tabs: [...record.tabs, tab] })),
    ),

  updateTabMetrics: (
    tabId: number,
    newMetrics: Metrics,
    carbon: CarbonEstimate,
    meta?: Partial<{ status: number; date: number }>,
  ): Promise<void> =>
    enqueue(() =>
      mutateToday((record) => {
        const tabs = record.tabs.map((tab) => {
          if (tab.id !== tabId) return tab;
          return {
            ...tab,
            metrics: newMetrics,
            carbon,
            meta: meta ? { ...tab.meta, ...meta } : tab.meta,
          };
        });
        return rebuildTotals({ ...record, tabs });
      }),
    ),

  getTabs: async (): Promise<MetricTab[]> => {
    const record = await getCachedDailyRecord();
    return record?.tabs ?? [];
  },

  getTotalMetrics: async (): Promise<Metrics> => {
    const record = await getCachedDailyRecord();
    return record?.totalMetrics ?? { ...emptyMetrics };
  },

  getTotalCarbon: async (): Promise<CarbonEstimate> => {
    const record = await getCachedDailyRecord();
    return record?.totalCarbon ?? { ...emptyCarbon };
  },

  clearPastDays: (retentionDays: number): Promise<void> => {
    if (retentionDays === -1) return Promise.resolve();
    return enqueue(async () => {
      const sessions = await ChromeStorage.getSessions();
      const today = getDailyDate();
      const cutoffDate = clock.now();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoff = cutoffDate.toLocaleDateString("sv"); // "sv" locale gives YYYY-MM-DD
      const filtered = Object.fromEntries(
        Object.entries(sessions).filter(([date]) => date >= cutoff || date === today),
      );
      await ChromeStorage.setSessions(filtered);
      invalidateCache();
    });
  },
};
