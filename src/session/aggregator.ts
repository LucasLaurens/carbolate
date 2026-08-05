import type { CarbonEstimate } from "../carbon/types";
import type { DailyRecord, Metrics } from "./types";

export const sumMetrics = (metricsArray: Metrics[]): Metrics => ({
  requestCount: metricsArray.reduce((sum, m) => sum + m.requestCount, 0),
  totalResourceSize: metricsArray.reduce((sum, m) => sum + m.totalResourceSize, 0),
  cpuTimeToLoad: metricsArray.reduce((sum, m) => sum + m.cpuTimeToLoad, 0),
});

export const sumCarbonEstimates = (estimates: CarbonEstimate[]): CarbonEstimate => ({
  networkCo2: estimates.reduce((s, e) => s + e.networkCo2, 0),
  cpuCo2: estimates.reduce((s, e) => s + e.cpuCo2, 0),
  // Records persisted before renderingCo2 existed lack the field entirely;
  // without the fallback every legacy day would total to NaN.
  renderingCo2: estimates.reduce((s, e) => s + (e.renderingCo2 ?? 0), 0),
  totalCo2: estimates.reduce((s, e) => s + e.totalCo2, 0),
});

/**
 * Neutral elements, derived from the sums rather than written out again.
 * Spelling the zeroed shape a second time is how `renderingCo2` came to be
 * missing from two separate empty literals — adding a field to `Metrics` or
 * `CarbonEstimate` now forces the sum to change, and both empties follow.
 */
export const emptyMetrics = (): Metrics => sumMetrics([]);

export const emptyCarbonEstimate = (): CarbonEstimate => sumCarbonEstimates([]);

/**
 * The neutral daily record, for a day on which nothing has been measured yet.
 * Returning it instead of `null` is what lets every reader drop its own
 * "no record" branch.
 */
export const emptyDailyRecord = (date: string): DailyRecord => ({
  date,
  tabs: [],
  totalMetrics: emptyMetrics(),
  totalCarbon: emptyCarbonEstimate(),
});
