import type { FootprintCalculator, CarbonEstimate, CarbonInput, ContributionMetric } from "./types";
import type { CarbonContributionSource } from "./contracts/CarbonContributionSource";
import { NetworkCarbonSource } from "./sources/NetworkCarbonSource";
import { DeviceCarbonSource } from "./sources/DeviceCarbonSource";
import { computeAvoidedCarbon } from "./avoidedCarbon";

const DEFAULT_SOURCES: readonly CarbonContributionSource[] = [
  new NetworkCarbonSource(),
  new DeviceCarbonSource(),
];

const NO_CONTRIBUTIONS: Record<ContributionMetric, number> = { networkCo2: 0, deviceCo2: 0 };

export default class CarbonCalculator implements FootprintCalculator<CarbonInput, CarbonEstimate> {
  constructor(private readonly sources: readonly CarbonContributionSource[] = DEFAULT_SOURCES) {}

  /**
   * O(s × n) time, O(1) space — s = sources, n = inputs.
   */
  calculate(inputs: readonly CarbonInput[]): CarbonEstimate {
    const contributions = this.sources.reduce<Record<ContributionMetric, number>>(
      (totals, source) => ({
        ...totals,
        [source.metric]: totals[source.metric] + source.calculate(inputs),
      }),
      { ...NO_CONTRIBUTIONS },
    );

    return {
      ...contributions,
      // Summed from the channels rather than tracked separately, so a new source
      // cannot ship without reaching the total.
      totalCo2: Object.values(contributions).reduce((sum, value) => sum + value, 0),
      avoidedCo2: computeAvoidedCarbon(inputs),
    };
  }
}
