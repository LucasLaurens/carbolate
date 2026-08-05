import type { CarbonInput, ContributionMetric } from "../types";

/**
 * One pluggable emission channel. Adding a channel means adding a class, not
 * editing `CarbonCalculator` — and `metric` is a contribution, so a source
 * cannot write into `avoidedCo2`.
 */
export interface CarbonContributionSource {
  readonly metric: ContributionMetric;
  calculate(inputs: readonly CarbonInput[]): number;
}
