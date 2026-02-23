import { CarbonEstimate, CarbonInput } from "../carbon/types";
import CarbonCalculator from "../carbon/CarbonCalculator";
import { sumMetrics } from "./aggregator";
import { getTodayKey } from "../utils/date";
import { ChromeStorage } from "../storage/ChromeStorage";
import { DailyRecord, MetricTab, Metrics, MetricsStore } from "./types";

const calculator = new CarbonCalculator();

const emptyMetrics: Metrics       = { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 };
const emptyCarbon:  CarbonEstimate = { networkCo2: 0, cpuCo2: 0, totalCo2: 0 };

const toInput = (m: Metrics): CarbonInput => ({
  transferSize: m.totalResourceSize,
  cpuTime:      m.cpuTimeToLoad,
});

const emptyRecord = (date: string): DailyRecord => ({
  date,
  tabs:         [],
  totalMetrics: { ...emptyMetrics },
  totalCarbon:  { ...emptyCarbon },
});

export const metricsStore: MetricsStore = {
  getOrCreateDailyRecord: async (date: string): Promise<DailyRecord> => {
    const sessions = await ChromeStorage.getSessions();
    if (sessions[date]) return sessions[date];

    const record = emptyRecord(date);
    await ChromeStorage.setSessions({ ...sessions, [date]: record });
    return record;
  },

  addTabToDay: async (date: string, tab: MetricTab): Promise<void> => {
    const sessions    = await ChromeStorage.getSessions();
    const record      = sessions[date] ?? emptyRecord(date);
    const tabs        = [...record.tabs, tab];
    const totalMetrics = sumMetrics(tabs.map(t => t.metrics));
    const totalCarbon  = calculator.calculate(tabs.map(t => toInput(t.metrics)));

    await ChromeStorage.setSessions({
      ...sessions,
      [date]: { ...record, tabs, totalMetrics, totalCarbon },
    });
  },

  updateTabInDay: async (date: string, tabId: number, newMetrics: Metrics): Promise<void> => {
    const sessions = await ChromeStorage.getSessions();
    const record   = sessions[date];
    if (!record) return;

    const tabs = record.tabs.map(tab => {
      if (tab.id !== tabId) return tab;
      const metrics = { ...tab.metrics, ...newMetrics };
      return { ...tab, metrics, carbon: calculator.calculate([toInput(metrics)]) };
    });
    const totalMetrics = sumMetrics(tabs.map(t => t.metrics));
    const totalCarbon  = calculator.calculate(tabs.map(t => toInput(t.metrics)));

    await ChromeStorage.setSessions({
      ...sessions,
      [date]: { ...record, tabs, totalMetrics, totalCarbon },
    });
  },

  getDailyRecord: async (date: string): Promise<DailyRecord | null> => {
    const sessions = await ChromeStorage.getSessions();
    return sessions[date] ?? null;
  },

  getAllDays: async (): Promise<DailyRecord[]> => {
    const sessions = await ChromeStorage.getSessions();
    return Object.values(sessions).sort((a, b) => a.date.localeCompare(b.date));
  },

  hasExistingTabById: async (tabId: number): Promise<boolean> => {
    const record = await metricsStore.getDailyRecord(getTodayKey());
    return record?.tabs.some(tab => tab.id === tabId) ?? false;
  },

  addTab: async (tab: Omit<MetricTab, "carbon">): Promise<void> => {
    const carbon = calculator.calculate([toInput(tab.metrics)]);
    await metricsStore.addTabToDay(getTodayKey(), { ...tab, carbon });
  },

  updateTabMetrics: async (tabId: number, newMetrics: Metrics): Promise<void> => {
    await metricsStore.updateTabInDay(getTodayKey(), tabId, newMetrics);
  },

  getTabs: async (): Promise<MetricTab[]> => {
    const record = await metricsStore.getDailyRecord(getTodayKey());
    return record?.tabs ?? [];
  },

  getTotalMetrics: async (): Promise<Metrics> => {
    const record = await metricsStore.getDailyRecord(getTodayKey());
    return record?.totalMetrics ?? { ...emptyMetrics };
  },

  getTotalCarbon: async (): Promise<CarbonEstimate> => {
    const record = await metricsStore.getDailyRecord(getTodayKey());
    return record?.totalCarbon ?? { ...emptyCarbon };
  },
};
