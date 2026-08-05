import type { CarbonContributionSource } from "../contracts/CarbonContributionSource";
import type { CarbonInput } from "../types";
import { CARBON_PER_GB } from "../constants";
import { bytesToGigabytes } from "../../utils/bytes";

/**
 * Emissions of the transmission networks and the data centres that served the
 * page, charged against the bytes that actually crossed the network.
 *
 * O(n) time, O(1) space — n = inputs.
 */
export class NetworkCarbonSource implements CarbonContributionSource {
  readonly metric = "networkCo2" as const;

  calculate(inputs: readonly CarbonInput[]): number {
    const gigabytes = bytesToGigabytes(
      inputs.reduce((sum, input) => sum + input.transferredBytes, 0),
    );
    return gigabytes * CARBON_PER_GB;
  }
}
