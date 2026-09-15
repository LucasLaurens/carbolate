import { describe, it, expect } from "vitest";
import { isPageMetricsMessage, MessageType } from "./messages";
import { PerformanceEntryType } from "../performance/enums/PerformanceEntryType";

const valid = {
  type: MessageType.PAGE_METRICS,
  timeOrigin: 1_771_800_000_000,
  payload: {
    [PerformanceEntryType.RESOURCE]: [{ transferSize: 10 }],
    [PerformanceEntryType.NAVIGATION]: [{ duration: 100 }],
  },
};

describe("isPageMetricsMessage", () => {
  it("accepts a well-formed page metrics message", () => {
    // Act & Assert
    expect(isPageMetricsMessage(valid)).toBe(true);
  });

  it("accepts empty entry arrays — emptiness is the measurement's call, not the guard's", () => {
    // Act & Assert
    expect(
      isPageMetricsMessage({
        type: MessageType.PAGE_METRICS,
        timeOrigin: 1_771_800_000_000,
        payload: {
          [PerformanceEntryType.RESOURCE]: [],
          [PerformanceEntryType.NAVIGATION]: [],
        },
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

  it("rejects a message with no payload", () => {
    // Act & Assert
    expect(isPageMetricsMessage({ type: MessageType.PAGE_METRICS })).toBe(false);
  });

  it("rejects a payload whose resource entries are not an array", () => {
    // Arrange — the shape that would throw one frame later, inside the measurement
    const malformed = {
      type: MessageType.PAGE_METRICS,
      timeOrigin: 1_771_800_000_000,
      payload: { [PerformanceEntryType.RESOURCE]: null, [PerformanceEntryType.NAVIGATION]: [] },
    };

    // Act & Assert
    expect(isPageMetricsMessage(malformed)).toBe(false);
  });

  it("rejects a payload missing its navigation entries", () => {
    // Act & Assert
    expect(
      isPageMetricsMessage({
        type: MessageType.PAGE_METRICS,
        timeOrigin: 1_771_800_000_000,
        payload: { [PerformanceEntryType.RESOURCE]: [] },
      }),
    ).toBe(false);
  });

  it.each([null, undefined, 42, "page_metrics", []])("rejects %o", (message) => {
    // Act & Assert
    expect(isPageMetricsMessage(message)).toBe(false);
  });
});
