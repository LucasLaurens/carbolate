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
  metrics: Metrics;
  meta: MetaData;
};

export type MetricsStore = {
  tabs: MetricTab[];
  totalMetrics: Metrics;
  addTab: (tab: MetricTab) => Promise<void>;
  updateTabMetrics: (tabId: number, newMetrics: Partial<Metrics>) => Promise<void>;
  getTabs: () => Promise<MetricTab[]>;
  getTotalMetrics: () => Promise<Metrics>;
  hasExistingTabById: (tabId: number) => Promise<boolean>;
};

const sumMetrics = (metricsArray: Metrics[]): Metrics => ({
  requestCount: metricsArray.reduce((sum, m) => sum + m.requestCount, 0),
  totalResourceSize: metricsArray.reduce((sum, m) => sum + m.totalResourceSize, 0),
  cpuTimeToLoad: metricsArray.reduce((sum, m) => sum + m.cpuTimeToLoad, 0),
});

export const metricsStore: MetricsStore = {
  tabs: [],
  totalMetrics: { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 },

  getTabs: async function () {
    return new Promise(resolve => {
      chrome.storage.local.get(["tabsMetrics"], (result) => {
        resolve(result.tabsMetrics || []);
      });
    });
  },

  getTotalMetrics: async function () {
    return new Promise(resolve => {
      chrome.storage.local.get(["totalMetrics"], (result) => {
        resolve(result.totalMetrics || { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 });
      });
    });
  },

  addTab: async function (tab: MetricTab) {
    const tabs: MetricTab[] = await this.getTabs();
    const newTabs = [...tabs, tab];
    const totalMetrics = sumMetrics(newTabs.map(t => t.metrics));

    chrome.storage.local.set({ tabsMetrics: newTabs, totalMetrics });
    this.tabs = newTabs;
    this.totalMetrics = totalMetrics;
  },

  updateTabMetrics: async function (tabId, newMetrics) {
    const tabs: MetricTab[] = await this.getTabs();
    const newTabs = tabs.map(tab =>
      tab.id === tabId ? { ...tab, metrics: { ...tab.metrics, ...newMetrics } } : tab
    );
    const totalMetrics = sumMetrics(newTabs.map(t => t.metrics));

    chrome.storage.local.set({ tabsMetrics: newTabs, totalMetrics });
    this.tabs = newTabs;
    this.totalMetrics = totalMetrics;
  },

  hasExistingTabById: async function (tabId: number) {
    const tabs = await this.getTabs();
    return tabs.some(tab => tab.id === tabId);
  },
};
