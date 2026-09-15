import type { PagePerformancePayload } from "../performance/PageMetrics";
import type { PageMetricsMessage } from "../messaging/messages";
import { MessageType } from "../messaging/messages";
import type { ObservationSink } from "./MetricsCollector";

export class RuntimeObservationSink implements ObservationSink {
  send(payload: PagePerformancePayload, timeOrigin: number): void {
    const message: PageMetricsMessage = { type: MessageType.PAGE_METRICS, payload, timeOrigin };
    chrome.runtime.sendMessage(message);
  }
}
