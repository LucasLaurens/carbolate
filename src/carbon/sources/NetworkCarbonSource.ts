import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { CARBON_PER_GB } from "../constants";
import { bytesToGigabytes } from "../../utils/bytes";

export class NetworkCarbonSource implements CarbonContributionSource {
  metric = "networkCo2" as const;

  calculate(inputs: CarbonInput[]): number {
    const totalGB = bytesToGigabytes(inputs.reduce((acc, item) => acc + item.transferSize, 0));
    return totalGB * CARBON_PER_GB;
  }
}
