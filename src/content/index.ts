import { VisitAccumulator } from "./VisitAccumulator";
import { RuntimeObservationSink } from "./RuntimeObservationSink";
import { PerformanceEntryType } from "../performance/enums/PerformanceEntryType";
import type { NavigationTiming } from "../performance/PageMetrics";
import { isThirdPartyResource } from "../utils/url";

/**
 * How often a living visit reports its totals. Below this the panel reads as
 * frozen; above it, the burst of resources that follows a load would be one
 * write per resource.
 */
const FLUSH_INTERVAL_MS = 5_000;

/**
 * When this script started measuring — **not** when the document did.
 *
 * As a visibility clock, `performance.timeOrigin` was wrong for a script that
 * did not start with its document: re-injected into a tab open for three hours
 * and visible, the accumulator reported three hours of screen time nobody spent.
 *
 * As an identity, it is what separates this instance from another observing the
 * same document, so a replayed and truncated buffer appends rather than
 * replacing a larger total.
 * See docs/decisions/2026-09-16-instance-d-observation.md
 */
const OBSERVED_FROM = Date.now();

const accumulator = new VisitAccumulator(document.visibilityState === "visible", OBSERVED_FROM);
const sink = new RuntimeObservationSink();

const flush = (): void =>
  sink.send({
    timeOrigin: performance.timeOrigin,
    observedFrom: OBSERVED_FROM,
    measurement: accumulator.readMeasurement(Date.now()),
  });

// `buffered: true` replays what the timeline already holds, so entries that
// arrived before this script ran are not lost — and observing from here on is
// what keeps a page past the 250-entry buffer cap from under-counting itself.
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const timing = entry as PerformanceResourceTiming;
    accumulator.addResource({
      transferSize: timing.transferSize,
      decodedBodySize: timing.decodedBodySize,
      // Classified here, where the resource URL is: only the count crosses the
      // wire, never the hosts a user's browsing met.
      thirdParty: isThirdPartyResource(timing.name, location.hostname),
    });
  }
}).observe({ type: PerformanceEntryType.RESOURCE, buffered: true });

document.addEventListener("visibilitychange", () => {
  const now = Date.now();
  if (document.visibilityState === "visible") {
    accumulator.markVisible(now);
    return;
  }
  // Hidden is also the last moment a closing tab is guaranteed to get: close the
  // window first, then report, so the flush carries it.
  accumulator.markHidden(now);
  flush();
});

// A bfcache restore is the same document, so the same visit: the counter resumes
// rather than a second entry appearing.
window.addEventListener("pageshow", () => accumulator.markVisible(Date.now()));

window.addEventListener("pagehide", () => {
  accumulator.markHidden(Date.now());
  flush();
});

function readNavigation(): NavigationTiming | undefined {
  const [navigation] = performance.getEntriesByType(PerformanceEntryType.NAVIGATION);
  return navigation === undefined ? undefined : { duration: navigation.duration };
}

function reportLoad(): void {
  accumulator.recordNavigation(readNavigation());
  flush();
}

// The load event is when the navigation entry becomes complete, and flushing
// there is what keeps the first figure immediate instead of up to five seconds late.
if (document.readyState === "complete") {
  reportLoad();
} else {
  window.addEventListener("load", reportLoad, { once: true });
}

// An orphaned script — its extension reloaded or updated — can deliver nothing
// more. Left running it would flush into the void every five seconds for as long
// as the tab stays open.
const heartbeat = setInterval(() => {
  flush();
  if (!sink.alive) clearInterval(heartbeat);
}, FLUSH_INTERVAL_MS);
