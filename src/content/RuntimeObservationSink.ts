import type { PageMeasurement } from "../performance/PageMetrics";
import type { PageMetricsMessage } from "../messaging/messages";
import { MessageType } from "../messaging/messages";

/** Where a flush goes. Injected, so the flushing rules can be exercised. */
export interface ObservationSink {
  send(measurement: PageMeasurement, timeOrigin: number): void;
}

export class RuntimeObservationSink implements ObservationSink {
  send(measurement: PageMeasurement, timeOrigin: number): void {
    const message: PageMetricsMessage = {
      type: MessageType.PAGE_METRICS,
      timeOrigin,
      measurement,
    };
    chrome.runtime.sendMessage(message);
  }
}
