import { measurePage } from "../performance/PageMetrics";
import type { PagePerformancePayload } from "../performance/PageMetrics";
import { toCarbonInput } from "../carbon/toCarbonInput";
import type { CarbonEstimate, CarbonInput, FootprintCalculator } from "../carbon/types";
import type { Metrics, PageVisitRecorder } from "../session/types";
import { bytesToMegabytes, millisecondsToSeconds } from "../utils/bytes";
import { parseDomain } from "../utils/url";

/** What one page load reports, as it crosses the content-script boundary. */
export type PageObservation = {
  tabId: number;
  url: string;
  payload: PagePerformancePayload;
  /** The document's start, read in the page — with `tabId` and `url`, the visit's identity. */
  timeOrigin: number;
};

/**
 * The single path from an observed page load to a stored, carbon-costed record.
 *
 * It exists so that this chain — validate, convert units, estimate, persist —
 * has one caller and one test surface. Held inside the background's message
 * listener, it was reachable only through `chrome.runtime`, and the test suite
 * had to re-implement it to assert anything.
 */
export class MetricsIntake {
  constructor(
    private readonly recorder: PageVisitRecorder,
    private readonly calculator: FootprintCalculator<CarbonInput, CarbonEstimate>,
  ) {}

  /**
   * Records the observation, or discards it when the page cannot be attributed
   * to a domain or reported no resource at all.
   *
   * O(n) time, O(1) space beyond the record itself — n = resource entries.
   */
  async record({ tabId, url, payload, timeOrigin }: PageObservation): Promise<void> {
    const parsed = parseDomain(url);
    if (!parsed.valid) return;

    const measurement = measurePage(payload);
    if (!measurement.valid) return;

    // Stored in megabytes and seconds; the carbon sources want bytes and
    // milliseconds. The round-trip through `toCarbonInput` is deliberate: it
    // guarantees the figure shown and the figure costed come from the same
    // stored value, so they can never drift apart by a rounding step.
    const metrics: Metrics = {
      requestCount: measurement.requests,
      totalResourceSize: bytesToMegabytes(measurement.transferredBytes),
      pageLoadDurationSec: millisecondsToSeconds(measurement.loadDurationMs),
      cachedPageWeight: bytesToMegabytes(measurement.cachedBytes),
    };

    // The identity timestamp comes from the document, never from the clock here:
    // every delta of one visit must carry the same one to route onto it.
    await this.recorder.recordPageVisit({
      tabId,
      url,
      domain: parsed.domain,
      metrics,
      carbon: this.calculator.calculate([toCarbonInput(metrics)]),
      meta: { date: timeOrigin },
    });
  }
}
