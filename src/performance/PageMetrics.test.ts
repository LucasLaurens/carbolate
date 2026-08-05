import { describe, it, expect } from "vitest";
import { measurePage } from "./PageMetrics";
import type { PagePerformancePayload } from "./PageMetrics";
import { PerformanceEntryType } from "./enums/PerformanceEntryType";

const payload = (
  resource: { transferSize: number }[],
  navigation: { duration: number }[] = [],
): PagePerformancePayload => ({
  [PerformanceEntryType.RESOURCE]: resource,
  [PerformanceEntryType.NAVIGATION]: navigation,
});

describe("measurePage", () => {
  it("rejects a payload with no resource entry", () => {
    // Act
    const result = measurePage(payload([], [{ duration: 800 }]));

    // Assert
    expect(result.valid).toBe(false);
  });

  it("counts one request per resource entry", () => {
    // Arrange
    const resources = [{ transferSize: 10 }, { transferSize: 20 }, { transferSize: 30 }];

    // Act
    const result = measurePage(payload(resources));

    // Assert
    expect(result).toMatchObject({ valid: true, requests: 3 });
  });

  it("sums transferred bytes across every resource", () => {
    // Act
    const result = measurePage(payload([{ transferSize: 1_200 }, { transferSize: 800 }]));

    // Assert
    expect(result).toMatchObject({ valid: true, transferredBytes: 2_000 });
  });

  it("counts a cache-served resource as a request carrying zero bytes", () => {
    // Act
    const result = measurePage(payload([{ transferSize: 0 }, { transferSize: 500 }]));

    // Assert
    expect(result).toMatchObject({ valid: true, requests: 2, transferredBytes: 500 });
  });

  it("takes the load duration from the first navigation entry", () => {
    // Act
    const result = measurePage(payload([{ transferSize: 1 }], [{ duration: 1_750 }]));

    // Assert
    expect(result).toMatchObject({ valid: true, loadDurationMs: 1_750 });
  });

  it("falls back to a zero duration when no navigation entry exists", () => {
    // Act
    const result = measurePage(payload([{ transferSize: 1 }], []));

    // Assert
    expect(result).toMatchObject({ valid: true, loadDurationMs: 0 });
  });

  it("narrows to the measurement only once valid has been checked", () => {
    // Arrange
    const result = measurePage(payload([{ transferSize: 64 }], [{ duration: 100 }]));

    // Act & Assert — the discriminant is what unlocks the fields, by construction
    if (!result.valid) throw new Error("expected a valid measurement");
    expect(result.requests).toBe(1);
    expect(result.transferredBytes).toBe(64);
    expect(result.loadDurationMs).toBe(100);
  });
});
