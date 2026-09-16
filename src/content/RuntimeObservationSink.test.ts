/**
 * The sink against a real `chrome.runtime` that happens to keep its messages in
 * memory — including one whose extension has been reloaded underneath it.
 */
import { describe, it, expect, afterEach } from "vitest";
import { RuntimeObservationSink } from "./RuntimeObservationSink";
import { createEmptyMeasurement } from "../performance/PageMetrics";
import { MessageType } from "../messaging/messages";

const TIME_ORIGIN = 1_789_553_896_639;

type Runtime = { sendMessage: (message: unknown) => Promise<unknown> };

const chromeGlobal = globalThis as unknown as { chrome: { runtime: Runtime } };
const realRuntime = chromeGlobal.chrome.runtime;

/** A background that receives and answers nothing, as the real one does. */
class InMemoryRuntime {
  readonly received: unknown[] = [];

  sendMessage = (message: unknown): Promise<unknown> => {
    this.received.push(message);
    return Promise.reject(new Error("The message port closed before a response was received."));
  };
}

/** The extension was reloaded; every script it injected is orphaned. */
class InvalidatedRuntime {
  sendMessage = (): Promise<unknown> => {
    throw new Error("Extension context invalidated.");
  };
}

afterEach(() => {
  chromeGlobal.chrome.runtime = realRuntime;
});

describe("RuntimeObservationSink", () => {
  it("sends the measurement with the document's own time origin", () => {
    // Arrange
    const runtime = new InMemoryRuntime();
    chromeGlobal.chrome.runtime = runtime;
    const sink = new RuntimeObservationSink();

    // Act
    sink.send(createEmptyMeasurement(), TIME_ORIGIN);

    // Assert
    expect(runtime.received).toEqual([
      { type: MessageType.PAGE_METRICS, timeOrigin: TIME_ORIGIN, measurement: expect.anything() },
    ]);
  });

  it("swallows the reply nobody sends, rather than raising an unhandled rejection", () => {
    // Arrange
    chromeGlobal.chrome.runtime = new InMemoryRuntime();
    const sink = new RuntimeObservationSink();

    // Act & Assert
    expect(() => sink.send(createEmptyMeasurement(), TIME_ORIGIN)).not.toThrow();
    expect(sink.alive).toBe(true);
  });

  it("does not let a reloaded extension throw into the page's own handlers", () => {
    // Arrange — this is what killed the flush on visibilitychange
    chromeGlobal.chrome.runtime = new InvalidatedRuntime();
    const sink = new RuntimeObservationSink();

    // Act & Assert
    expect(() => sink.send(createEmptyMeasurement(), TIME_ORIGIN)).not.toThrow();
  });

  it("reports itself dead once the context is gone, so the caller stops flushing", () => {
    // Arrange
    chromeGlobal.chrome.runtime = new InvalidatedRuntime();
    const sink = new RuntimeObservationSink();

    // Act
    sink.send(createEmptyMeasurement(), TIME_ORIGIN);

    // Assert
    expect(sink.alive).toBe(false);
  });
});
