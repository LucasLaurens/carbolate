import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { SCREEN_FACTOR } from "../constants";
import { millisecondsToSeconds } from "../../utils/bytes";

/**
 * The screen's share of the footprint, charged against the time it was lit.
 *
 * Its input is the load duration because that is the only lit time the
 * extension observes today — the living record (#40) is what will widen it to
 * the whole display time. The factor does not change when that lands.
 *
 * O(n) time, O(1) space — n = inputs.
 */
export class ScreenCarbonSource implements CarbonContributionSource {
  readonly metric = "screenCo2" as const;

  calculate(inputs: readonly CarbonInput[]): number {
    const seconds = millisecondsToSeconds(
      inputs.reduce((sum, input) => sum + input.pageLoadDurationMs, 0),
    );
    return seconds * SCREEN_FACTOR;
  }
}
