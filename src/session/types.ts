import type { CarbonEstimate } from "../carbon/types";

export type Metrics = {
  requestCount: number;
  totalResourceSize: number;
  cpuTimeToLoad: number;
};

type MetaData = {
  status: number;
  date: number; // timestamp
};

export type MetricTab = {
  id: number;
  url: string;
  domain: string;
  metrics: Metrics;
  meta: MetaData;
  carbon: CarbonEstimate;
};

export type DailyRecord = {
  date: string; // ISO "YYYY-MM-DD"
  tabs: MetricTab[];
  totalMetrics: Metrics;
  totalCarbon: CarbonEstimate;
};

export type SessionsStore = Record<string, DailyRecord>;

export type MetricsStore = {
  // Daily record operations
  getOrCreateDailyRecord: (date: string) => Promise<DailyRecord>;
  addTabToDay: (date: string, tab: MetricTab) => Promise<void>;
  updateTabInDay: (date: string, tabId: number, newMetrics: Metrics) => Promise<void>;
  getDailyRecord: (date: string) => Promise<DailyRecord | null>;
  getAllDays: () => Promise<DailyRecord[]>;
  // Today convenience methods
  addTab: (tab: Omit<MetricTab, "carbon">) => Promise<void>;
  updateTabMetrics: (tabId: number, newMetrics: Metrics) => Promise<void>;
  getTabs: () => Promise<MetricTab[]>;
  getTotalMetrics: () => Promise<Metrics>;
  getTotalCarbon: () => Promise<CarbonEstimate>;
  hasExistingTabById: (tabId: number) => Promise<boolean>;
};
