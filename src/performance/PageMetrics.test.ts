import { describe, it, expect } from "vitest";
import { addResourceTiming, createEmptyMeasurement, withLoadDuration } from "./PageMetrics";
import type { ResourceTiming } from "./PageMetrics";

const foldAll = (timings: ResourceTiming[]) =>
  timings.reduce(addResourceTiming, createEmptyMeasurement());

describe("createEmptyMeasurement", () => {
  it("starts every channel at zero, so a page that reported nothing claims nothing", () => {
    // Act & Assert
    expect(createEmptyMeasurement()).toEqual({
      requests: 0,
      transferredBytes: 0,
      loadDurationMs: 0,
      cachedBytes: 0,
      visibleDurationMs: 0,
    });
  });
});

describe("addResourceTiming", () => {
  it("counts one request per resource", () => {
    // Act
    const result = foldAll([{ transferSize: 10 }, { transferSize: 20 }, { transferSize: 30 }]);

    // Assert
    expect(result.requests).toBe(3);
  });

  it("sums transferred bytes across every resource", () => {
    // Act
    const result = foldAll([{ transferSize: 1_200 }, { transferSize: 800 }]);

    // Assert
    expect(result.transferredBytes).toBe(2_000);
  });

  it("credits a cache hit — zero transferred, a decoded body of its own", () => {
    // Act
    const result = foldAll([{ transferSize: 0, decodedBodySize: 120_000 }]);

    // Assert
    expect(result.cachedBytes).toBe(120_000);
    expect(result.transferredBytes).toBe(0);
  });

  it("credits nothing to a resource that crossed the network", () => {
    // Act — a real transfer, decoded size known: it was downloaded, not spared
    const result = foldAll([{ transferSize: 40_000, decodedBodySize: 120_000 }]);

    // Assert
    expect(result.cachedBytes).toBe(0);
  });

  it("credits nothing when a stale content script sent no decoded size", () => {
    // Act
    const result = foldAll([{ transferSize: 0 }]);

    // Assert — the absence costs the avoided figure, never the whole observation
    expect(result.cachedBytes).toBe(0);
    expect(result.requests).toBe(1);
  });

  it("leaves the measurement it was given untouched", () => {
    // Arrange
    const before = createEmptyMeasurement();

    // Act
    addResourceTiming(before, { transferSize: 500 });

    // Assert — a living visit keeps folding; a mutated total would double-count
    expect(before.requests).toBe(0);
    expect(before.transferredBytes).toBe(0);
  });
});

describe("withLoadDuration", () => {
  it("takes the navigation entry's duration", () => {
    // Act
    const result = withLoadDuration(createEmptyMeasurement(), { duration: 1_750 });

    // Assert
    expect(result.loadDurationMs).toBe(1_750);
  });

  it("falls back to zero when the page reported no navigation entry", () => {
    // Act — prerendered and some SPA loads report none
    const result = withLoadDuration(createEmptyMeasurement(), undefined);

    // Assert
    expect(result.loadDurationMs).toBe(0);
  });
});
