import type { CarbonEstimate } from "../carbon/types";
import type { Metrics } from "./types";

export const sumMetrics = (metricsArray: Metrics[]): Metrics => ({
  requestCount: metricsArray.reduce((sum, m) => sum + m.requestCount, 0),
  totalResourceSize: metricsArray.reduce((sum, m) => sum + m.totalResourceSize, 0),
  cpuTimeToLoad: metricsArray.reduce((sum, m) => sum + m.cpuTimeToLoad, 0),
});

export const sumCarbonEstimates = (estimates: CarbonEstimate[]): CarbonEstimate => ({
  networkCo2: estimates.reduce((s, e) => s + e.networkCo2, 0),
  cpuCo2: estimates.reduce((s, e) => s + e.cpuCo2, 0),
  totalCo2: estimates.reduce((s, e) => s + e.totalCo2, 0),
});
