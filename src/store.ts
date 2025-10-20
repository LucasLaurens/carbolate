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
  updateTabMetrics: (tabId: number, newMetrics: Metrics) => Promise<void>;
  getTabs: () => Promise<MetricTab[]>;
  getTotalMetrics: () => Promise<Metrics>;
  hasExistingTabById: (tabId: number) => Promise<boolean>;
};

// todo: move from a specific metric helper
const sumMetrics = (metricsArray: Metrics[]): Metrics => ({
  requestCount: metricsArray.reduce((sum, metric) => sum + metric.requestCount, 0),
  totalResourceSize: metricsArray.reduce((sum, metric) => sum + metric.totalResourceSize, 0),
  cpuTimeToLoad: metricsArray.reduce((sum, metric) => sum + metric.cpuTimeToLoad, 0),
});

export const metricsStore: MetricsStore = {
  tabs: [],
  totalMetrics: { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 },

  // WRITE
  addTab: async function (newTab: MetricTab): Promise<void> {
    let tabs: MetricTab[] = await this.getTabs();
    tabs = [...tabs, newTab];
    const totalMetrics = sumMetrics(tabs.map(tab => tab.metrics));

    // todo: manage the local storage from a specific class dedicated
    chrome.storage.local.set({ tabs, totalMetrics });

    this.tabs = tabs;
    this.totalMetrics = totalMetrics;
  },
  updateTabMetrics: async function (tabId: number, newMetrics: Metrics): Promise<void> {
    let tabs: MetricTab[] = await this.getTabs();
    tabs = tabs.map(tab => tab.id === tabId
      ? { ...tab, metrics: { ...tab.metrics, ...newMetrics } }
      : tab
    );
    const totalMetrics = sumMetrics(tabs.map(tab => tab.metrics));

    chrome.storage.local.set({ tabs, totalMetrics });

    this.tabs = tabs;
    this.totalMetrics = totalMetrics;
  },

  // READ
  hasExistingTabById: async function (tabId: number): Promise<boolean> {
    const tabs = await this.getTabs();
    return tabs.some(tab => tab.id === tabId);
  },
  getTabs: async function () {
    return new Promise(resolve => {
      // todo: type hinting result
      chrome.storage.local.get(["tabs"], (result) => {
        resolve(result.tabs || []);
      });
    });
  },
  getTotalMetrics: async function () {
    return new Promise(resolve => {
      // todo: type hinting result
      chrome.storage.local.get(["totalMetrics"], (result) => {
        resolve(result.totalMetrics || { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 });
      });
    });
  },
};
