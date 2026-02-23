import type { Carbon, CarbonEstimate, CarbonInput } from "./types";
import { CARBON_PER_GB, NETWORK_RATIO, CPU_FACTOR } from "./constants";

export default class CarbonCalculator implements Carbon<CarbonInput, CarbonEstimate> {
  calculate(input: CarbonInput[]): CarbonEstimate {
    const totalGB = input.reduce((calc, item) => calc + item.transferSize, 0) / 1_000_000_000;
    const totalSec = input.reduce((calc, item) => calc + item.cpuTime, 0) / 1000;

    const networkCo2 = totalGB * CARBON_PER_GB * NETWORK_RATIO;
    const cpuCo2 = totalSec * CPU_FACTOR;

    return {
      networkCo2: Math.round(networkCo2),
      cpuCo2: Math.round(cpuCo2),
      totalCo2: Math.round(networkCo2 + cpuCo2),
    };
  }
}
