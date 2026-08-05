import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { RENDERING_FACTOR } from "../constants";
import { millisecondsToSeconds } from "../../utils/bytes";

export class RenderingCarbonSource implements CarbonContributionSource {
  metric = "renderingCo2" as const;

  calculate(inputs: CarbonInput[]): number {
    const totalSec = millisecondsToSeconds(inputs.reduce((acc, item) => acc + item.cpuTime, 0));
    return totalSec * RENDERING_FACTOR;
  }
}
