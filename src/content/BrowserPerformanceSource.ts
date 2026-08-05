import { PerformanceEntryType } from "../performance/enums/PerformanceEntryType";
import type { NavigationTiming, ResourceTiming } from "../performance/PageMetrics";
import type { PerformanceSource } from "./MetricsCollector";

/**
 * The real Performance API, projected onto plain objects.
 *
 * `PerformanceResourceTiming` and `PerformanceNavigationTiming` are host objects
 * that Chrome's structured clone algorithm refuses to serialize, so the
 * projection is not a convenience — a message carrying the entries themselves
 * never arrives.
 */
export class BrowserPerformanceSource implements PerformanceSource {
  resources(): readonly ResourceTiming[] {
    const entries = performance.getEntriesByType(
      PerformanceEntryType.RESOURCE,
    ) as PerformanceResourceTiming[];
    return entries.map((entry) => ({ transferSize: entry.transferSize }));
  }

  navigations(): readonly NavigationTiming[] {
    return performance
      .getEntriesByType(PerformanceEntryType.NAVIGATION)
      .map((entry) => ({ duration: entry.duration }));
  }
}
