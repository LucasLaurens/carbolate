import type { ICarbonSource } from "../ICarbonSource";
import type { CarbonInput } from "../types";
import { CPU_FACTOR } from "../constants";

export class CpuCarbonSource implements ICarbonSource {
  calculate(inputs: CarbonInput[]): number {
    const totalSec = inputs.reduce((acc, item) => acc + item.cpuTime, 0) / 1000;
    return totalSec * CPU_FACTOR;
  }
}
