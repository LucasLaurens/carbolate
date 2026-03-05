import type { CarbonEstimate, CarbonInput } from "./types";

export type ContributionMetric = keyof Omit<CarbonEstimate, "totalCo2">;

export interface CarbonContributionSource {
  metric: ContributionMetric;
  calculate(inputs: CarbonInput[]): number;
}
