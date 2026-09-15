import { VisitAccumulator } from "./VisitAccumulator";
import { RuntimeObservationSink } from "./RuntimeObservationSink";
import { PerformanceEntryType } from "../performance/enums/PerformanceEntryType";
import type { NavigationTiming } from "../performance/PageMetrics";

/**
 * How often a living visit reports its totals. Below this the panel reads as
 * frozen; above it, the burst of resources that follows a load would be one
 * write per resource.
 */
const FLUSH_INTERVAL_MS = 5_000;

const accumulator = new VisitAccumulator(
  document.visibilityState === "visible",
  performance.timeOrigin,
);
const sink = new RuntimeObservationSink();

const flush = (): void =>
  sink.send(accumulator.readMeasurement(Date.now()), performance.timeOrigin);

// `buffered: true` replays what the timeline already holds, so entries that
// arrived before this script ran are not lost — and observing from here on is
// what keeps a page past the 250-entry buffer cap from under-counting itself.
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const timing = entry as PerformanceResourceTiming;
    accumulator.addResource({
      transferSize: timing.transferSize,
      decodedBodySize: timing.decodedBodySize,
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

setInterval(flush, FLUSH_INTERVAL_MS);
