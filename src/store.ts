import { create } from 'zustand'

export type Metrics = {
  requestCount: number;
  totalResourceSize: number;
  cpuTimeToLoad: number;
};

type MetaData = {
  status: number;
  date: number; // timestamp
};

type MetricTab = {
  id: number;
  metrics: Metrics;
  meta: MetaData;
};

type MetricsStore = {
  tabs: MetricTab[];
  totalMetrics: Metrics;
  updateTabMetrics: (tabId: number, newMetrics: Partial<Metrics>) => void;
  addTab: (currentTab: MetricTab) => void;
  // removeTab: (tabId: number) => void;
  // computeTotalMetrics: () => void;
};

const sumMetrics = (metricsArray: Metrics[]): Metrics => ({
  requestCount: metricsArray.reduce((sum, metrics) => sum + metrics.requestCount, 0),
  totalResourceSize: metricsArray.reduce((sum, metrics) => sum + metrics.totalResourceSize, 0),
  cpuTimeToLoad: metricsArray.reduce((sum, metrics) => sum + metrics.cpuTimeToLoad, 0),
});

export const useMetricsStore = create<MetricsStore>((set, get) => ({
  tabs: [],
  totalMetrics: { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 },

  updateTabMetrics: (tabId, newMetrics) => {
    set(state => {
      const tabs = state.tabs.map(tab => tab.id === tabId
        ? { ...tab, metrics: { ...tab.metrics, ...newMetrics } }
        : tab
      );
      const totalMetrics = sumMetrics(tabs.map(tab => tab.metrics));
      return { tabs, totalMetrics };
    });
  },

  addTab: (currentTab) => set(state => ({
    tabs: [...state.tabs, currentTab],
    totalMetrics: sumMetrics([...state.tabs.map(tab => tab.metrics), currentTab.metrics]),
  })),

  // removeTab: (tabId) => set(state => {
  //   const tabs = state.tabs.filter(tab => tab.id !== tabId);
  //   return { tabs, totalMetrics: sumMetrics(tabs.map(tab => tab.metrics)) };
  // }),

  // computeTotalMetrics: () => {
  //   const { tabs } = get();
  //   const totalMetrics = sumMetrics(tabs.map(tab => tab.metrics));
  //   set({ totalMetrics });
  // },
}));
