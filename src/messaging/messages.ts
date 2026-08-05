import { PerformanceEntryType } from "../performance/enums/PerformanceEntryType";
import type { PagePerformancePayload } from "../performance/PageMetrics";

/** Single home for the `chrome.runtime` message discriminants. */
export enum MessageType {
  PAGE_METRICS = "page_metrics",
}

/**
 * The wire contract between a content script and the background. Both sides
 * import this type, so a field cannot be added on one end only.
 */
export type PageMetricsMessage = {
  type: MessageType.PAGE_METRICS;
  payload: PagePerformancePayload;
};

/**
 * Guards the background's only untrusted-shape entry point. `onMessage` is
 * typed `any`, and a payload missing its arrays would throw one frame later
 * inside the measurement instead of being dropped here.
 */
export function isPageMetricsMessage(message: unknown): message is PageMetricsMessage {
  if (typeof message !== "object" || message === null) return false;

  const candidate = message as { type?: unknown; payload?: unknown };
  if (candidate.type !== MessageType.PAGE_METRICS) return false;
  if (typeof candidate.payload !== "object" || candidate.payload === null) return false;

  const payload = candidate.payload as Record<string, unknown>;
  return (
    Array.isArray(payload[PerformanceEntryType.RESOURCE]) &&
    Array.isArray(payload[PerformanceEntryType.NAVIGATION])
  );
}
