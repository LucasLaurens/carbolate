import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { DEVICE_FACTOR } from "../constants";
import { millisecondsToSeconds } from "../../utils/bytes";

/**
 * Energy the user's machine spent loading the page, charged against the load
 * duration. One value, one factor, one name — replaces the `cpuCo2` /
 * `renderingCo2` pair that multiplied this same duration twice.
 *
 * O(n) time, O(1) space — n = inputs.
 */
export class DeviceCarbonSource implements CarbonContributionSource {
  readonly metric = "deviceCo2" as const;

  calculate(inputs: readonly CarbonInput[]): number {
    const seconds = millisecondsToSeconds(
      inputs.reduce((sum, input) => sum + input.pageLoadDurationMs, 0),
    );
    return seconds * DEVICE_FACTOR;
  }
}
