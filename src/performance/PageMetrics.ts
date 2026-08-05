import { PerformanceEntryType } from "./enums/PerformanceEntryType";

/**
 * `PerformanceResourceTiming` and `PerformanceNavigationTiming` are host objects
 * that Chrome's structured clone algorithm refuses to serialize, so a content
 * script can only forward these plain projections of them.
 */
export type ResourceTiming = { transferSize: number };
export type NavigationTiming = { duration: number };

export type PagePerformancePayload = {
  [PerformanceEntryType.RESOURCE]: readonly ResourceTiming[];
  [PerformanceEntryType.NAVIGATION]: readonly NavigationTiming[];
};

/** Raw units, straight from the Performance API: bytes and milliseconds. */
export type PageMeasurement = {
  requests: number;
  transferredBytes: number;
  loadDurationMs: number;
};

export type PageMeasurementResult = ({ valid: true } & PageMeasurement) | { valid: false };

/**
 * A page with no resource entry was not observed, it was merely visited too
 * early — counting it as zero would dilute the daily totals with empty rows.
 *
 * O(n) time, O(1) space — n = resource entries on the page.
 */
export function measurePage(payload: PagePerformancePayload): PageMeasurementResult {
  const resources = payload[PerformanceEntryType.RESOURCE];
  if (resources.length === 0) return { valid: false };

  let transferredBytes = 0;
  for (const resource of resources) transferredBytes += resource.transferSize;

  const [navigation] = payload[PerformanceEntryType.NAVIGATION];

  return {
    valid: true,
    requests: resources.length,
    transferredBytes,
    // Prerendered and some SPA loads report no navigation entry at all: the
    // duration is then unknown, and zero is the only floor that invents nothing.
    loadDurationMs: navigation === undefined ? 0 : navigation.duration,
  };
}
