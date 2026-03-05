import type { CarbonContributionSource } from "../CarbonContributionSource";
import type { CarbonInput } from "../types";
import { CPU_FACTOR } from "../constants";

export class CpuCarbonSource implements CarbonContributionSource {
  metric = "cpuCo2" as const;

  calculate(inputs: CarbonInput[]): number {
    const totalSec = inputs.reduce((acc, item) => acc + item.cpuTime, 0) / 1000;
    return totalSec * CPU_FACTOR;
  }
}
