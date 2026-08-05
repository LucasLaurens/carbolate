import { MetricsCollector } from "./MetricsCollector";
import { BrowserPerformanceSource } from "./BrowserPerformanceSource";
import { RuntimeObservationSink } from "./RuntimeObservationSink";

const collector = new MetricsCollector(
  new BrowserPerformanceSource(),
  new RuntimeObservationSink(),
);

// Resource timings are only complete once the load event has fired, and a
// content script injected at document_idle can arrive on either side of it.
if (document.readyState === "complete") {
  collector.collect();
} else {
  window.addEventListener("load", () => collector.collect(), { once: true });
}
