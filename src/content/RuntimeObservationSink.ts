import type { PagePerformancePayload } from "../performance/PageMetrics";
import type { PageMetricsMessage } from "../messaging/messages";
import { MessageType } from "../messaging/messages";
import type { ObservationSink } from "./MetricsCollector";

export class RuntimeObservationSink implements ObservationSink {
  send(payload: PagePerformancePayload): void {
    const message: PageMetricsMessage = { type: MessageType.PAGE_METRICS, payload };
    chrome.runtime.sendMessage(message);
  }
}
