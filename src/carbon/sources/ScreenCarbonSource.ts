import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { SCREEN_FACTOR } from "../constants";
import { millisecondsToSeconds } from "../../utils/bytes";

/**
 * The screen's share of the footprint, charged against the time the page was
 * **visible** — not the time it existed.
 *
 * The load duration is deliberately not added: a page visible while it loads is
 * already inside its visible time, and charging both would bill that window
 * twice. A page loaded in a background tab and never looked at is charged no
 * screen at all, which is what "attributional" means — the panel showed nothing
 * of it. See docs/decisions/2026-09-15-enregistrement-vivant.md
 *
 * O(n) time, O(1) space — n = inputs.
 */
export class ScreenCarbonSource implements CarbonContributionSource {
  readonly metric = "screenCo2" as const;

  calculate(inputs: readonly CarbonInput[]): number {
    const seconds = millisecondsToSeconds(
      inputs.reduce((sum, input) => sum + input.visibleDurationMs, 0),
    );
    return seconds * SCREEN_FACTOR;
  }
}
