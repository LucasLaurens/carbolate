import type { CarbonInput } from "../types";
import type { ContributionMetric } from "../types";

export interface CarbonContributionSource {
  metric: ContributionMetric;
  calculate(inputs: CarbonInput[]): number;
}
