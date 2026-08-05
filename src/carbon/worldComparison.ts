import { DAILY_BROWSING_REFERENCE_G_CO2, WORLD_COMPARISON_MULTIPLIERS } from "./constants";

/**
 * A **coarse position** against the daily reference — deliberately not a ratio.
 *
 * The reference is a full-perimeter estimate (it amortises the manufacturing of
 * devices and network gear) while Carbolate is usage-only, so the two are not
 * measured the same way and the comparison carries a structural 20–25 % bias in
 * the flattering direction. A rounded percentage such as "−73 %" would hide that
 * behind a precision it does not have; a coarse word survives it.
 * See docs/decisions/2026-08-05-niveaux-sobriete-et-reference-mondiale.md
 */
export type WorldComparison = "wellBelow" | "below" | "around" | "above" | "wellAbove";

/** O(1) time and space. */
export function compareToDailyReference(totalCo2: number): WorldComparison {
  const ratio = totalCo2 / DAILY_BROWSING_REFERENCE_G_CO2;
  if (ratio < WORLD_COMPARISON_MULTIPLIERS.wellBelow) return "wellBelow";
  if (ratio < WORLD_COMPARISON_MULTIPLIERS.below) return "below";
  if (ratio <= WORLD_COMPARISON_MULTIPLIERS.around) return "around";
  if (ratio <= WORLD_COMPARISON_MULTIPLIERS.above) return "above";
  return "wellAbove";
}
