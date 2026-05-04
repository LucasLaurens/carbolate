import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { CARBON_PER_GB } from "../constants";

export class NetworkCarbonSource implements CarbonContributionSource {
  metric = "networkCo2" as const;

  calculate(inputs: CarbonInput[]): number {
    const totalGB = inputs.reduce((acc, item) => acc + item.transferSize, 0) / 1_000_000_000;
    return totalGB * CARBON_PER_GB;
  }
}
