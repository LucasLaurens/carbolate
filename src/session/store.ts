import type { CarbonEstimate, CarbonInput } from "../carbon/types";
import CarbonCalculator from "../carbon/CarbonCalculator";
import { sumMetrics, sumCarbonEstimates } from "./aggregator";
import { ChromeStorage } from "../storage/ChromeStorage";
import type { DailyRecord, MetricTab, Metrics, MetricsStore } from "./types";
import { getDailyDate } from "../utils/date";

const calculator = new CarbonCalculator();

const emptyMetrics: Metrics = { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 };
const emptyCarbon: CarbonEstimate = { networkCo2: 0, cpuCo2: 0, totalCo2: 0 };

const carbonMetricsCallback = (m: Metrics): CarbonInput => ({
  transferSize: m.totalResourceSize * 1024 * 1024, // MiB → bytes
  cpuTime: m.cpuTimeToLoad * 1000, // s → ms
});

const baseRecord = (date: string): DailyRecord => ({
  date,
  tabs: [],
  totalMetrics: { ...emptyMetrics },
  totalCarbon: { ...emptyCarbon },
});

const addTabToRecord = async (tab: MetricTab): Promise<void> => {
  const date = getDailyDate();
  const sessions = await ChromeStorage.getSessions();
  const record = sessions[date] ?? baseRecord(date);
  const tabs = [...record.tabs, tab];
  const totalMetrics = sumMetrics(tabs.map((t) => t.metrics));
  const totalCarbon = sumCarbonEstimates(tabs.map((t) => t.carbon));

  await ChromeStorage.setSessions({
    ...sessions,
    [date]: { ...record, tabs, totalMetrics, totalCarbon },
  });
};

const updateTabInRecord = async (tabId: number, newMetrics: Metrics): Promise<void> => {
  const date = getDailyDate();
  const sessions = await ChromeStorage.getSessions();
  const record = sessions[date];
  if (!record) return;

  const tabs = record.tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    const metrics = { ...tab.metrics, ...newMetrics };
    return { ...tab, metrics, carbon: calculator.calculate([carbonMetricsCallback(metrics)]) };
  });
  const totalMetrics = sumMetrics(tabs.map((t) => t.metrics));
  const totalCarbon = sumCarbonEstimates(tabs.map((t) => t.carbon));

  await ChromeStorage.setSessions({
    ...sessions,
    [date]: { ...record, tabs, totalMetrics, totalCarbon },
  });
};

export const metricsStore: MetricsStore = {
  findDailyRecord: async (): Promise<DailyRecord | null> => {
    const sessions = await ChromeStorage.getSessions();
    return sessions[getDailyDate()] ?? null;
  },

  findOrCreateDailyRecord: async (): Promise<DailyRecord> => {
    const date = getDailyDate();
    const sessions = await ChromeStorage.getSessions();
    if (sessions[date]) return sessions[date];
    const record = baseRecord(date);
    await ChromeStorage.setSessions({ ...sessions, [date]: record });
    return record;
  },

  getAllDays: async (): Promise<DailyRecord[]> => {
    const sessions = await ChromeStorage.getSessions();
    return Object.values(sessions).sort((a, b) => a.date.localeCompare(b.date));
  },

  hasExistingTabById: async (tabId: number): Promise<boolean> => {
    const record = await metricsStore.findDailyRecord();
    return record?.tabs.some((tab) => tab.id === tabId) ?? false;
  },

  addTab: async (tab: Omit<MetricTab, "carbon">): Promise<void> => {
    const carbon = calculator.calculate([carbonMetricsCallback(tab.metrics)]);
    await addTabToRecord({ ...tab, carbon });
  },

  updateTabMetrics: async (tabId: number, newMetrics: Metrics): Promise<void> => {
    await updateTabInRecord(tabId, newMetrics);
  },

  getTabs: async (): Promise<MetricTab[]> => {
    const record = await metricsStore.findDailyRecord();
    return record?.tabs ?? [];
  },

  getTotalMetrics: async (): Promise<Metrics> => {
    const record = await metricsStore.findDailyRecord();
    return record?.totalMetrics ?? { ...emptyMetrics };
  },

  getTotalCarbon: async (): Promise<CarbonEstimate> => {
    const record = await metricsStore.findDailyRecord();
    return record?.totalCarbon ?? { ...emptyCarbon };
  },

  clearPastDays: async (retentionDays: number): Promise<void> => {
    if (retentionDays === -1) return; // Keep everything

    const sessions = await ChromeStorage.getSessions();
    const today = getDailyDate();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffDate = cutoff.toISOString().split("T")[0];

    const filtered = Object.fromEntries(
      Object.entries(sessions).filter(([date]) => date >= cutoffDate || date === today),
    );

    await ChromeStorage.setSessions(filtered);
  },
};
