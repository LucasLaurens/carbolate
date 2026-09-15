import type { PageMeasurement } from "../performance/PageMetrics";

/** Single home for the `chrome.runtime` message discriminants. */
export enum MessageType {
  PAGE_METRICS = "page_metrics",
}

/**
 * The wire contract between a content script and the background. Both sides
 * import this type, so a field cannot be added on one end only.
 *
 * The measurement is **cumulative**: a living visit reports its totals again
 * rather than what changed since last time. A replayed message is then a no-op
 * and a lost one is caught by the next, neither of which is true of increments —
 * and `chrome.runtime.sendMessage` promises neither delivery nor uniqueness.
 */
export type PageMetricsMessage = {
  type: MessageType.PAGE_METRICS;
  /**
   * The document's `performance.timeOrigin`, read in the page. It is what makes
   * two reloads two visits, so it travels with the measurement rather than being
   * stamped on arrival.
   */
  timeOrigin: number;
  measurement: PageMeasurement;
};

const MEASUREMENT_FIELDS = [
  "requests",
  "transferredBytes",
  "loadDurationMs",
  "cachedBytes",
  "visibleDurationMs",
] as const;

/**
 * Guards the background's only untrusted-shape entry point. `onMessage` is typed
 * `any`, and a field missing from the measurement would surface as `NaN` in a
 * stored total instead of being dropped here.
 *
 * O(1) — five fields.
 */
export function isPageMetricsMessage(message: unknown): message is PageMetricsMessage {
  if (typeof message !== "object" || message === null) return false;

  const candidate = message as { type?: unknown; timeOrigin?: unknown; measurement?: unknown };
  if (candidate.type !== MessageType.PAGE_METRICS) return false;
  if (!Number.isFinite(candidate.timeOrigin)) return false;
  if (typeof candidate.measurement !== "object" || candidate.measurement === null) return false;

  const measurement = candidate.measurement as Record<string, unknown>;
  return MEASUREMENT_FIELDS.every((field) => Number.isFinite(measurement[field]));
}
