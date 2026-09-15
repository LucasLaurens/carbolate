import type { CarbonEstimate } from "../carbon/types";
import type { DailyRecord, Metrics } from "./types";

/** O(n) time, O(1) space — n = entries. */
export const sumMetrics = (entries: readonly Metrics[]): Metrics => ({
  requestCount: entries.reduce((sum, each) => sum + each.requestCount, 0),
  totalResourceSize: entries.reduce((sum, each) => sum + each.totalResourceSize, 0),
  pageLoadDurationSec: entries.reduce((sum, each) => sum + each.pageLoadDurationSec, 0),
  cachedPageWeight: entries.reduce((sum, each) => sum + each.cachedPageWeight, 0),
});

/**
 * Adds every channel independently, `avoidedCo2` included — it is summed like the
 * rest but stays out of `totalCo2`, which only adds up what browsing cost.
 *
 * Every estimate reaching this function has been through
 * {@link normalizeDailyRecord}, so no field can be absent and no fallback is
 * needed here. That guard used to live inline, which is why the same `?? 0` had
 * to be repeated in the CSV export.
 *
 * O(n) time, O(1) space — n = estimates.
 */
export const sumCarbonEstimates = (estimates: readonly CarbonEstimate[]): CarbonEstimate => ({
  networkCo2: estimates.reduce((sum, each) => sum + each.networkCo2, 0),
  deviceCo2: estimates.reduce((sum, each) => sum + each.deviceCo2, 0),
  screenCo2: estimates.reduce((sum, each) => sum + each.screenCo2, 0),
  totalCo2: estimates.reduce((sum, each) => sum + each.totalCo2, 0),
  avoidedCo2: estimates.reduce((sum, each) => sum + each.avoidedCo2, 0),
});

/**
 * Neutral elements, derived from the sums rather than written out again.
 * Spelling the zeroed shape a second time is how `renderingCo2` came to be
 * missing from two separate empty literals — adding a field to `Metrics` or
 * `CarbonEstimate` now forces the sum to change, and both empties follow.
 */
export const createEmptyMetrics = (): Metrics => sumMetrics([]);

export const createEmptyCarbonEstimate = (): CarbonEstimate => sumCarbonEstimates([]);

/**
 * The neutral daily record, for a day on which nothing has been measured yet.
 * Returning it instead of `null` is what lets every reader drop its own
 * "no record" branch.
 */
export const createEmptyDailyRecord = (date: string): DailyRecord => ({
  date,
  tabs: [],
  totalMetrics: createEmptyMetrics(),
  totalCarbon: createEmptyCarbonEstimate(),
});
