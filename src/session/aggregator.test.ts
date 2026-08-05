import { describe, it, expect } from "vitest";
import {
  sumMetrics,
  sumCarbonEstimates,
  emptyMetrics,
  emptyCarbonEstimate,
  emptyDailyRecord,
} from "./aggregator";
import type { Metrics } from "./types";
import type { CarbonEstimate } from "../carbon/types";

/**
 * Type-checked reference shapes. Adding a field to `Metrics` or `CarbonEstimate`
 * breaks compilation here, which forces the field into the sums below — and the
 * key comparisons then prove the neutral elements zero it out. This is the check
 * that was missing when `renderingCo2` shipped absent from two empty literals.
 */
const POPULATED_METRICS: Metrics = {
  requestCount: 7,
  totalResourceSize: 1.5,
  pageLoadDurationSec: 2.25,
  cachedPageWeight: 0.75,
};

const POPULATED_ESTIMATE: CarbonEstimate = {
  networkCo2: 0.5,
  deviceCo2: 0.028,
  totalCo2: 0.528,
  avoidedCo2: 0.13,
};

describe("neutral elements cover every field of their type", () => {
  it("zeroes every key of Metrics", () => {
    // Act
    const empty = emptyMetrics();

    // Assert
    expect(Object.keys(empty).sort()).toEqual(Object.keys(POPULATED_METRICS).sort());
    expect(Object.values(empty).every((value) => value === 0)).toBe(true);
  });

  it("zeroes every key of CarbonEstimate", () => {
    // Act
    const empty = emptyCarbonEstimate();

    // Assert
    expect(Object.keys(empty).sort()).toEqual(Object.keys(POPULATED_ESTIMATE).sort());
    expect(Object.values(empty).every((value) => value === 0)).toBe(true);
  });

  it("returns a fresh object each call so callers cannot share mutable state", () => {
    // Act
    const first = emptyCarbonEstimate();
    const second = emptyCarbonEstimate();
    first.networkCo2 = 99;

    // Assert
    expect(second.networkCo2).toBe(0);
  });
});

describe("sums are identity-preserving", () => {
  it("returns the single element unchanged when summing one Metrics", () => {
    // Act & Assert
    expect(sumMetrics([POPULATED_METRICS])).toEqual(POPULATED_METRICS);
  });

  it("returns the single element unchanged when summing one CarbonEstimate", () => {
    // Act & Assert
    expect(sumCarbonEstimates([POPULATED_ESTIMATE])).toEqual(POPULATED_ESTIMATE);
  });

  it("adding the neutral element changes nothing", () => {
    // Act & Assert
    expect(sumMetrics([POPULATED_METRICS, emptyMetrics()])).toEqual(POPULATED_METRICS);
    expect(sumCarbonEstimates([POPULATED_ESTIMATE, emptyCarbonEstimate()])).toEqual(
      POPULATED_ESTIMATE,
    );
  });
});

describe("sums add across entries", () => {
  it("adds every field of two Metrics", () => {
    // Act & Assert
    expect(
      sumMetrics([
        { requestCount: 5, totalResourceSize: 1, pageLoadDurationSec: 0.5, cachedPageWeight: 2 },
        { requestCount: 3, totalResourceSize: 2, pageLoadDurationSec: 1.5, cachedPageWeight: 3 },
      ]),
    ).toEqual({
      requestCount: 8,
      totalResourceSize: 3,
      pageLoadDurationSec: 2,
      cachedPageWeight: 5,
    });
  });

  it("adds every field of two CarbonEstimates", () => {
    // Act
    const summed = sumCarbonEstimates([POPULATED_ESTIMATE, POPULATED_ESTIMATE]);

    // Assert
    expect(summed.networkCo2).toBeCloseTo(POPULATED_ESTIMATE.networkCo2 * 2, 10);
    expect(summed.deviceCo2).toBeCloseTo(POPULATED_ESTIMATE.deviceCo2 * 2, 10);
    expect(summed.totalCo2).toBeCloseTo(POPULATED_ESTIMATE.totalCo2 * 2, 10);
  });

  it("adds avoided CO₂ across entries without letting it reach the total", () => {
    // Act
    const summed = sumCarbonEstimates([POPULATED_ESTIMATE, POPULATED_ESTIMATE]);

    // Assert — it accumulates like the rest, and stays out of what browsing cost
    expect(summed.avoidedCo2).toBeCloseTo(POPULATED_ESTIMATE.avoidedCo2 * 2, 10);
    expect(summed.totalCo2).toBeCloseTo(summed.networkCo2 + summed.deviceCo2, 10);
  });
});

describe("the neutral daily record", () => {
  it("carries the day it was asked for", () => {
    // Act & Assert
    expect(emptyDailyRecord("2026-02-23").date).toBe("2026-02-23");
  });

  it("holds no tab and zeroed totals, so no reader needs a null branch", () => {
    // Act
    const record = emptyDailyRecord("2026-02-23");

    // Assert
    expect(record.tabs).toEqual([]);
    expect(record.totalMetrics).toEqual(emptyMetrics());
    expect(record.totalCarbon).toEqual(emptyCarbonEstimate());
  });
});
