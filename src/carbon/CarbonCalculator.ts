import type { Carbon, CarbonEstimate, CarbonInput } from "./types";
import type { CarbonContributionSource, ContributionMetric } from "./CarbonContributionSource";
import { NetworkCarbonSource } from "./sources/NetworkCarbonSource";
import { CpuCarbonSource } from "./sources/CpuCarbonSource";

const DEFAULT_SOURCES: CarbonContributionSource[] = [new NetworkCarbonSource(), new CpuCarbonSource()];

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

    const network = Math.round(totals.networkCo2);
    const cpu = Math.round(totals.cpuCo2);

    return {
      networkCo2: network,
      cpuCo2: cpu,
      totalCo2: network + cpu,
    };
  }
}
