export type CarbonInput = {
  transferredBytes: number;
  pageLoadDurationMs: number;
  /** Uncompressed size of what the cache served — the input of avoided CO₂. */
  cachedBytes: number;
};

export type CarbonEstimate = {
  networkCo2: number;
  deviceCo2: number;
  /**
   * The share of the screen's draw charged to browsing. An **attributional**
   * figure: a lit panel is not caused by the page, only used by it — which is
   * why it adds to `totalCo2` but never counts as something browsing could
   * avoid.
   */
  screenCo2: number;
  totalCo2: number;
  /**
   * What the cache spared. A positive, pedagogical figure that is **never**
   * subtracted from `totalCo2`: the total says what browsing cost, this says
   * what it would have cost without a cache.
   */
  avoidedCo2: number;
};

/**
 * The channels that add up to `totalCo2`. `avoidedCo2` is excluded on purpose —
 * it is part of the estimate but not a contribution to it, and letting it into
 * this union would let a source add it to the total.
 */
export type ContributionMetric = keyof Omit<CarbonEstimate, "totalCo2" | "avoidedCo2">;

export interface FootprintCalculator<Input, Output> {
  calculate(inputs: Input[]): Output;
}
