import type { Carbon, CarbonEstimate, CarbonInput } from "./types";
import type { CarbonContributionSource, ContributionMetric } from "./CarbonContributionSource";
import { NetworkCarbonSource } from "./sources/NetworkCarbonSource";
import { CpuCarbonSource } from "./sources/CpuCarbonSource";

const DEFAULT_SOURCES: CarbonContributionSource[] = [
  new NetworkCarbonSource(),
  new CpuCarbonSource(),
];

export default class CarbonCalculator implements Carbon<CarbonInput, CarbonEstimate> {
  private sources: CarbonContributionSource[];

  constructor(sources: CarbonContributionSource[] = DEFAULT_SOURCES) {
    this.sources = sources;
  }

  calculate(input: CarbonInput[]): CarbonEstimate {
    const totals = this.sources.reduce<Record<ContributionMetric, number>>(
      (acc, source) => {
        acc[source.metric] += source.calculate(input);
        return acc;
      },
      { networkCo2: 0, cpuCo2: 0 },
    );

    return {
      networkCo2: totals.networkCo2,
      cpuCo2: totals.cpuCo2,
      totalCo2: totals.networkCo2 + totals.cpuCo2,
    };
  }
}
