import { PerformanceEntryType } from "../performance/enums/PerformanceEntryType";
import type {
  NavigationTiming,
  PagePerformancePayload,
  ResourceTiming,
} from "../performance/PageMetrics";

/** Where the timings come from. Injected, so the rules below can be exercised. */
export interface PerformanceSource {
  readResources(): readonly ResourceTiming[];
  readNavigations(): readonly NavigationTiming[];
  /** When this document started — the visit's identity, read in the page. */
  readTimeOrigin(): number;
}

/** Where the observation goes. Injected, for the same reason. */
export interface ObservationSink {
  send(payload: PagePerformancePayload, timeOrigin: number): void;
}

/**
 * Reads what the page reported and hands it over, once.
 *
 * Keeping the two globals — `performance` and `chrome.runtime` — behind ports is
 * what makes the collection rules assertable without a DOM or a browser: the
 * living-record work lands here, and it is all conditional logic.
 * See docs/decisions/2026-08-05-page-visit-unite-de-mesure.md
 */
export class MetricsCollector {
  constructor(
    private readonly source: PerformanceSource,
    private readonly sink: ObservationSink,
  ) {}

  collect(): void {
    this.sink.send(
      {
        [PerformanceEntryType.RESOURCE]: this.source.readResources(),
        [PerformanceEntryType.NAVIGATION]: this.source.readNavigations(),
      },
      this.source.readTimeOrigin(),
    );
  }
}
