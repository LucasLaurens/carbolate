import { CARBON_PER_GB } from "./constants";
import type { CarbonInput } from "./types";
import { bytesToGigabytes } from "../utils/bytes";

/**
 * What the cache spared the network, from the uncompressed size of the resources
 * it served.
 *
 * It applies the **network** factor because a network transfer is precisely the
 * emission that did not happen. It is not a {@link CarbonContributionSource}:
 * those add up to the total, and this must never be subtracted from it — a
 * well-cached site would otherwise report a negative footprint.
 *
 * A cache hit is not free in reality, but its residual cost is *time* — decoding
 * and disk reads — which the device factor already charges through the load
 * duration. Adding a per-byte factor would count the same energy twice, and no
 * published source gives gCO₂e per byte read from a disk.
 * See docs/decisions/2026-08-05-perimetre-modele-carbone.md
 *
 * O(n) time, O(1) space — n = inputs.
 */
export function avoidedCarbon(inputs: readonly CarbonInput[]): number {
  const bytes = inputs.reduce((sum, input) => sum + input.cachedBytes, 0);
  return bytesToGigabytes(bytes) * CARBON_PER_GB;
}
