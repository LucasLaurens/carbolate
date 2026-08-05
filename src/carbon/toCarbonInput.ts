import type { CarbonInput } from "./types";
import type { Metrics } from "../session/types";
import { megabytesToBytes, secondsToMilliseconds } from "../utils/bytes";

/**
 * Adapts stored {@link Metrics} (MB, seconds) to the units the carbon sources
 * expect (bytes, milliseconds). Single home for this conversion: the background
 * and the test suite both go through it, so a unit change cannot land in one
 * without the other.
 */
export const toCarbonInput = (metrics: Metrics): CarbonInput => ({
  transferSize: megabytesToBytes(metrics.totalResourceSize),
  cpuTime: secondsToMilliseconds(metrics.cpuTimeToLoad),
});
