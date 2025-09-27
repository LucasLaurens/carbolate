import { create } from 'zustand'

type Metrics = {
  requestCount: number;
  totalResourceSize: number;
  cpuTimeToLoad: number;
}

type MetaData = {
  status: number;
  date: number; // timestamp
};

type MetricState = Metrics & MetaData

type MetricsStore = {
  metrics: MetricState;
  updateMetrics: (newMetrics: Partial<Metrics>) => void;
};

export const useMetricStore = create<MetricsStore>((set) => ({
  metrics: {
    totalResourceSize: 0,
    requestCount: 0,
    cpuTimeToLoad: 0,
    status: 1,
    date: Date.now()
  },
updateMetrics: (newMetrics) => set((state) => {
  return {
    ...state,
    metrics: {
      ...state.metrics,
      ...newMetrics,
    }
  };
}),
}))