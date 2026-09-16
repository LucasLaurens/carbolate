import type { PageMetricsMessage, PageObservationPayload } from "../messaging/messages";
import { MessageType } from "../messaging/messages";

/** Where a flush goes. Injected, so the flushing rules can be exercised. */
export interface ObservationSink {
  send(payload: PageObservationPayload): void;
  /**
   * False once the extension that injected this script is gone. Nothing measured
   * from here on can reach storage, so the caller stops flushing.
   */
  readonly alive: boolean;
}

export class RuntimeObservationSink implements ObservationSink {
  private sendable = true;

  get alive(): boolean {
    return this.sendable;
  }

  /**
   * A content script outlives the extension that injected it — an update, or a
   * reload of an unpacked build. `sendMessage` then throws "Extension context
   * invalidated" **synchronously**, and this used to escape into the page's own
   * event handlers: the flush on `visibilitychange` died with it, so a visit's
   * accumulated visible time was never reported and the day kept the figure from
   * its load flush, which for a tab opened in the background is zero.
   *
   * The failure cannot be recovered — this context has no way back — so it is
   * recorded rather than retried, and the caller stops the interval.
   */
  send(payload: PageObservationPayload): void {
    if (!this.sendable) return;

    const message: PageMetricsMessage = { type: MessageType.PAGE_METRICS, ...payload };

    try {
      // MV3 with no callback returns a promise, and a background that answers
      // nothing rejects it. That rejection is noise, not a signal: the message
      // was delivered.
      void Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => {});
    } catch {
      this.sendable = false;
    }
  }
}
