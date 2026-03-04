import type { Carbon, CarbonEstimate, CarbonInput } from "./types";
import type { ICarbonSource } from "./ICarbonSource";
import { NetworkCarbonSource } from "./sources/NetworkCarbonSource";
import { CpuCarbonSource } from "./sources/CpuCarbonSource";

const DEFAULT_SOURCES: ICarbonSource[] = [new NetworkCarbonSource(), new CpuCarbonSource()];

export default class CarbonCalculator implements Carbon<CarbonInput, CarbonEstimate> {
  private sources: ICarbonSource[];

  constructor(sources: ICarbonSource[] = DEFAULT_SOURCES) {
    this.sources = sources;
  }

  calculate(input: CarbonInput[]): CarbonEstimate {
    const [networkCo2, cpuCo2] = this.sources.map((s) => s.calculate(input));
    const network = Math.round(networkCo2 ?? 0);
    const cpu = Math.round(cpuCo2 ?? 0);
    return {
      networkCo2: network,
      cpuCo2: cpu,
      totalCo2: network + cpu,
    };
  }
}
