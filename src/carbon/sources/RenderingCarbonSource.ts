import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { RENDERING_FACTOR } from "../constants";

export class RenderingCarbonSource implements CarbonContributionSource {
  metric = "renderingCo2" as const;

  calculate(inputs: CarbonInput[]): number {
    const totalSec = inputs.reduce((acc, item) => acc + item.cpuTime, 0) / 1000;
    return totalSec * RENDERING_FACTOR;
  }
}
