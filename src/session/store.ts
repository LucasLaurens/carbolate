import type { CarbonEstimate, CarbonInput } from "../carbon/types";
import CarbonCalculator from "../carbon/CarbonCalculator";
import { sumMetrics, sumCarbonEstimates } from "./aggregator";
import { ChromeStorage } from "../storage/ChromeStorage";
import type { DailyRecord, MetricTab, Metrics, MetricsStore } from "./types";
import { getDailyDate } from "../utils/date";

const calculator = new CarbonCalculator();

const emptyMetrics: Metrics = { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 };
const emptyCarbon: CarbonEstimate = { networkCo2: 0, cpuCo2: 0, totalCo2: 0 };

const toCarbonInput = (m: Metrics): CarbonInput => ({
  transferSize: m.totalResourceSize * 1024 * 1024, // MiB → bytes
  cpuTime: m.cpuTimeToLoad * 1000, // s → ms
});

const emptyDailyRecord = (date: string): DailyRecord => ({
  date,
  tabs: [],
  totalMetrics: { ...emptyMetrics },
  totalCarbon: { ...emptyCarbon },
});

// In-memory cache
let cache: DailyRecord | null = null;
let cacheDate: string = "";

export function invalidateCache(): void {
  cache = null;
  cacheDate = "";
}

// Register reset hook for test environments
(globalThis as Record<string, unknown>).__carbolateCacheReset = invalidateCache;

async function getCachedDailyRecord(): Promise<DailyRecord | null> {
  const today = getDailyDate();
  if (cache && cacheDate === today) return cache;
  const sessions = await ChromeStorage.getSessions();
  cache = sessions[today] ?? null;
  cacheDate = today;
  return cache;
}

const addTabToRecord = async (tab: MetricTab): Promise<void> => {
  const date = getDailyDate();
  const sessions = await ChromeStorage.getSessions();
  const record = sessions[date] ?? emptyDailyRecord(date);
  const tabs = [...record.tabs, tab];
  const totalMetrics = sumMetrics(tabs.map((t) => t.metrics));
  const totalCarbon = sumCarbonEstimates(tabs.map((t) => t.carbon));

  await ChromeStorage.setSessions({
    ...sessions,
    [date]: { ...record, tabs, totalMetrics, totalCarbon },
  });
  invalidateCache();
};

const updateTabInRecord = async (
  tabId: number,
  newMetrics: Metrics,
  meta?: Partial<{ status: number; date: number }>,
): Promise<void> => {
  const date = getDailyDate();
  const sessions = await ChromeStorage.getSessions();
  const record = sessions[date];
  if (!record) return;

  const tabs = record.tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    const metrics = { ...tab.metrics, ...newMetrics };
    const updatedMeta = meta ? { ...tab.meta, ...meta } : tab.meta;
    return {
      ...tab,
      metrics,
      meta: updatedMeta,
      carbon: calculator.calculate([toCarbonInput(metrics)]),
    };
  });
  const totalMetrics = sumMetrics(tabs.map((t) => t.metrics));
  const totalCarbon = sumCarbonEstimates(tabs.map((t) => t.carbon));

  await ChromeStorage.setSessions({
    ...sessions,
    [date]: { ...record, tabs, totalMetrics, totalCarbon },
  });
  invalidateCache();
};

export const metricsStore: MetricsStore = {
  findDailyRecord: async (): Promise<DailyRecord | null> => {
    return getCachedDailyRecord();
  },

  findOrCreateDailyRecord: async (): Promise<DailyRecord> => {
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
  },

  getAllDays: async (): Promise<DailyRecord[]> => {
    const sessions = await ChromeStorage.getSessions();
    return Object.values(sessions).sort((a, b) => a.date.localeCompare(b.date));
  },

  hasExistingTabById: async (tabId: number): Promise<boolean> => {
    const record = await getCachedDailyRecord();
    return record?.tabs.some((tab) => tab.id === tabId) ?? false;
  },

  addTab: async (tab: Omit<MetricTab, "carbon">): Promise<void> => {
    const carbon = calculator.calculate([toCarbonInput(tab.metrics)]);
    await addTabToRecord({ ...tab, carbon });
  },

  updateTabMetrics: async (
    tabId: number,
    newMetrics: Metrics,
    meta?: Partial<{ status: number; date: number }>,
  ): Promise<void> => {
    await updateTabInRecord(tabId, newMetrics, meta);
  },

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

  clearPastDays: async (retentionDays: number): Promise<void> => {
    if (retentionDays === -1) return; // Keep everything

    const sessions = await ChromeStorage.getSessions();
    const today = getDailyDate();

    // Use getDailyDate()-style YYYY-MM-DD strings to avoid timezone drift
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoff = cutoffDate.toLocaleDateString("sv"); // "sv" locale gives YYYY-MM-DD

    const filtered = Object.fromEntries(
      Object.entries(sessions).filter(([date]) => date >= cutoff || date === today),
    );

    await ChromeStorage.setSessions(filtered);
    invalidateCache();
  },
};
