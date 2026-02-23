import type { Metrics } from "./types";

export const sumMetrics = (metricsArray: Metrics[]): Metrics => ({
  requestCount: metricsArray.reduce((sum, m) => sum + m.requestCount, 0),
  totalResourceSize: metricsArray.reduce((sum, m) => sum + m.totalResourceSize, 0),
  cpuTimeToLoad: metricsArray.reduce((sum, m) => sum + m.cpuTimeToLoad, 0),
});
