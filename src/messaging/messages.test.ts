import { describe, it, expect } from "vitest";
import { isPageMetricsMessage, MessageType } from "./messages";
import { createEmptyMeasurement } from "../performance/PageMetrics";

const valid = {
  type: MessageType.PAGE_METRICS,
  timeOrigin: 1_771_800_000_000,
  measurement: { ...createEmptyMeasurement(), requests: 1, transferredBytes: 10 },
};

describe("isPageMetricsMessage", () => {
  it("accepts a well-formed page metrics message", () => {
    // Act & Assert
    expect(isPageMetricsMessage(valid)).toBe(true);
  });

  it("accepts a zeroed measurement — emptiness is the intake's call, not the guard's", () => {
    // Act & Assert
    expect(
      isPageMetricsMessage({
        type: MessageType.PAGE_METRICS,
        timeOrigin: 1_771_800_000_000,
        measurement: createEmptyMeasurement(),
      }),
    ).toBe(true);
  });

  it("rejects a message with no document start — the visit would have no identity", () => {
    // Arrange — a content script from before the page-visit key, still running in an old tab
    const { timeOrigin: _dropped, ...withoutOrigin } = valid;

    // Act & Assert
    expect(isPageMetricsMessage(withoutOrigin)).toBe(false);
  });

  it("rejects a document start that is not a finite number", () => {
    // Act & Assert
    expect(isPageMetricsMessage({ ...valid, timeOrigin: "1771800000000" })).toBe(false);
    expect(isPageMetricsMessage({ ...valid, timeOrigin: Number.NaN })).toBe(false);
  });

  it("rejects another message type", () => {
    // Act & Assert
    expect(isPageMetricsMessage({ ...valid, type: "something_else" })).toBe(false);
  });

  it("rejects a message with no measurement", () => {
    // Act & Assert
    expect(isPageMetricsMessage({ type: MessageType.PAGE_METRICS, timeOrigin: 1 })).toBe(false);
  });

  it("rejects a measurement whose field is not a number", () => {
    // Arrange — the shape that would surface as NaN inside a stored total
    const malformed = {
      ...valid,
      measurement: { ...createEmptyMeasurement(), transferredBytes: "10" },
    };

    // Act & Assert
    expect(isPageMetricsMessage(malformed)).toBe(false);
  });

  it("rejects a measurement missing the visible time — a field added after the fact", () => {
    // Arrange — a content script from before the living record, still running
    const { visibleDurationMs: _dropped, ...withoutVisible } = createEmptyMeasurement();

    // Act & Assert
    expect(isPageMetricsMessage({ ...valid, measurement: withoutVisible })).toBe(false);
  });

  it.each([null, undefined, 42, "page_metrics", []])("rejects %o", (message) => {
    // Act & Assert
    expect(isPageMetricsMessage(message)).toBe(false);
  });
});
