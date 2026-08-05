import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { CPU_FACTOR } from "../constants";
import { millisecondsToSeconds } from "../../utils/bytes";

export class CpuCarbonSource implements CarbonContributionSource {
  metric = "cpuCo2" as const;

  calculate(inputs: CarbonInput[]): number {
    const totalSec = millisecondsToSeconds(inputs.reduce((acc, item) => acc + item.cpuTime, 0));
    return totalSec * CPU_FACTOR;
  }
}
