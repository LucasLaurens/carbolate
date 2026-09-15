/**
 * `PerformanceResourceTiming` and `PerformanceNavigationTiming` are host objects
 * that Chrome's structured clone algorithm refuses to serialize, so a content
 * script can only forward these plain projections of them.
 */
export type ResourceTiming = {
  transferSize: number;
  /**
   * Whether the resource came from another registrable domain than the page.
   * Decided **in the page**, where the resource URL lives: sending those URLs to
   * the background would put the list of trackers a user meets into storage and
   * into the CSV export, which is a profile, not a measurement.
   */
  thirdParty: boolean;
  /**
   * Optional because a content script injected **before** an extension update
   * keeps running the old projection until its tab reloads, and that projection
   * did not carry this field. Its absence must cost the avoided figure, not the
   * whole observation.
   */
  decodedBodySize?: number;
};

export type NavigationTiming = { duration: number };

/**
 * What one visit has measured **so far**. Raw units, straight from the
 * Performance API: bytes and milliseconds.
 *
 * It is cumulative, and it is what crosses the wire: a living visit reports its
 * totals again rather than what changed, so a replayed message is a no-op and a
 * lost one is caught by the next.
 * See docs/decisions/2026-09-15-enregistrement-vivant.md
 */
export type PageMeasurement = {
  requests: number;
  transferredBytes: number;
  loadDurationMs: number;
  /** Uncompressed size of the resources the cache served — see avoided CO₂. */
  cachedBytes: number;
  /**
   * How many of those requests came from a third party.
   *
   * A count of **requests**, never a share of bytes: a cross-origin resource
   * whose server omits `Timing-Allow-Origin` reports a size of zero, and only
   * ~25 % of third-party requests carry that header — `google-analytics.com` and
   * `googletagmanager.com` do not. A byte share would therefore under-report
   * exactly the trackers it claims to expose, while every request is countable.
   * See docs/decisions/2026-09-15-poids-tiers.md
   */
  thirdPartyRequests: number;
  /**
   * How long the page was **visible**, not how long it existed. A tab loaded in
   * the background and never looked at reports zero here, and is charged no
   * screen at all: the panel showed nothing of it.
   */
  visibleDurationMs: number;
};

export const createEmptyMeasurement = (): PageMeasurement => ({
  requests: 0,
  transferredBytes: 0,
  loadDurationMs: 0,
  cachedBytes: 0,
  thirdPartyRequests: 0,
  visibleDurationMs: 0,
});

/**
 * Folds one resource into the running totals.
 *
 * Incremental by necessity, not by taste: the resource timing buffer holds 250
 * entries per document and drops the rest in silence, so a measurement that
 * re-reads the buffer under-counts a heavy page. Observed one at a time, each
 * entry is counted the moment it exists.
 *
 * O(1) time and space.
 */
export function addResourceTiming(
  measurement: PageMeasurement,
  timing: ResourceTiming,
): PageMeasurement {
  // A zero transfer with a non-empty decoded body is the cache's signature: the
  // bytes reached the page, they just never crossed the network.
  const fromCache = timing.transferSize === 0 && Number.isFinite(timing.decodedBodySize);

  return {
    ...measurement,
    requests: measurement.requests + 1,
    thirdPartyRequests: measurement.thirdPartyRequests + (timing.thirdParty ? 1 : 0),
    transferredBytes: measurement.transferredBytes + timing.transferSize,
    cachedBytes: measurement.cachedBytes + (fromCache ? (timing.decodedBodySize ?? 0) : 0),
  };
}

/**
 * Prerendered and some SPA loads report no navigation entry at all: the duration
 * is then unknown, and zero is the only floor that invents nothing.
 *
 * O(1) time and space.
 */
export function withLoadDuration(
  measurement: PageMeasurement,
  navigation: NavigationTiming | undefined,
): PageMeasurement {
  return { ...measurement, loadDurationMs: navigation === undefined ? 0 : navigation.duration };
}
