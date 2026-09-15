import { describe, it, expect } from "vitest";
import CarbonCalculator from "../src/carbon/CarbonCalculator";
import { NetworkCarbonSource } from "../src/carbon/sources/NetworkCarbonSource";
import { DeviceCarbonSource } from "../src/carbon/sources/DeviceCarbonSource";
import { ScreenCarbonSource } from "../src/carbon/sources/ScreenCarbonSource";
import { computeAvoidedCarbon } from "../src/carbon/avoidedCarbon";
import type { CarbonInput } from "../src/carbon/types";
import { CARBON_PER_GB, DEVICE_FACTOR, SCREEN_FACTOR } from "../src/carbon/constants";

const ONE_GB = 1_000_000_000;

const input = (overrides: Partial<CarbonInput> = {}): CarbonInput => ({
  transferredBytes: 0,
  pageLoadDurationMs: 0,
  cachedBytes: 0,
  ...overrides,
});

describe("CarbonCalculator", () => {
  const calculator = new CarbonCalculator();

  it("returns a zeroed estimate for an empty input array", () => {
    // Act & Assert
    expect(calculator.calculate([])).toEqual({
      networkCo2: 0,
      deviceCo2: 0,
      screenCo2: 0,
      totalCo2: 0,
      avoidedCo2: 0,
    });
  });

  it("charges transferred bytes at the network factor", () => {
    // Act
    const result = calculator.calculate([input({ transferredBytes: ONE_GB })]);

    // Assert
    expect(result.networkCo2).toBe(CARBON_PER_GB);
    expect(result.deviceCo2).toBe(0);
    expect(result.totalCo2).toBe(CARBON_PER_GB);
  });

  it("charges the load duration at the device factor", () => {
    // Act — 1 000 000 ms = 1 000 s
    const result = calculator.calculate([input({ pageLoadDurationMs: 1_000_000 })]);

    // Assert
    expect(result.deviceCo2).toBeCloseTo(1_000 * DEVICE_FACTOR, 10);
    expect(result.networkCo2).toBe(0);
  });

  it("keeps the total equal to the sum of its channels", () => {
    // Act
    const result = calculator.calculate([
      input({ transferredBytes: ONE_GB, pageLoadDurationMs: 1_000_000 }),
    ]);

    // Assert
    expect(result.totalCo2).toBeCloseTo(
      result.networkCo2 + result.deviceCo2 + result.screenCo2,
      10,
    );
  });

  it("sums transferred bytes across several inputs", () => {
    // Act
    const result = calculator.calculate([
      input({ transferredBytes: ONE_GB / 2 }),
      input({ transferredBytes: ONE_GB / 2 }),
    ]);

    // Assert
    expect(result.networkCo2).toBeCloseTo(CARBON_PER_GB, 10);
  });

  it("splits the machine into device and screen without moving the total", () => {
    // Act — what the single 0.0014 factor used to charge on its own
    const result = calculator.calculate([input({ pageLoadDurationMs: 10_000 })]);

    // Assert — naming the panel separately must not change what a stored day totals to
    expect(result.deviceCo2 + result.screenCo2).toBeCloseTo(10 * 0.0014, 10);
    expect(DEVICE_FACTOR + SCREEN_FACTOR).toBeCloseTo(0.0014, 10);
  });

  it("never lets avoided CO₂ reach the total", () => {
    // Act — nothing crossed the network, everything came from cache
    const result = calculator.calculate([input({ cachedBytes: ONE_GB })]);

    // Assert — a well-cached page must not report a negative or reduced footprint
    expect(result.avoidedCo2).toBeCloseTo(CARBON_PER_GB, 10);
    expect(result.totalCo2).toBe(0);
  });

  it("accepts a source list of its own, without editing the calculator", () => {
    // Arrange
    const networkOnly = new CarbonCalculator([new NetworkCarbonSource()]);

    // Act
    const result = networkOnly.calculate([
      input({ transferredBytes: ONE_GB, pageLoadDurationMs: 1_000_000 }),
    ]);

    // Assert
    expect(result.networkCo2).toBe(CARBON_PER_GB);
    expect(result.deviceCo2).toBe(0);
    expect(result.screenCo2).toBe(0);
    expect(result.totalCo2).toBe(CARBON_PER_GB);
  });
});

describe("NetworkCarbonSource", () => {
  const source = new NetworkCarbonSource();

  it("returns 0 for empty inputs", () => {
    // Act & Assert
    expect(source.calculate([])).toBe(0);
  });

  it("applies CARBON_PER_GB to transferred bytes", () => {
    // Act
    const result = source.calculate([input({ transferredBytes: 2 * ONE_GB })]);

    // Assert
    expect(result).toBeCloseTo(2 * CARBON_PER_GB, 10);
  });

  it("ignores bytes the cache served — they never crossed the network", () => {
    // Act
    const result = source.calculate([input({ cachedBytes: ONE_GB })]);

    // Assert
    expect(result).toBe(0);
  });
});

describe("DeviceCarbonSource", () => {
  const source = new DeviceCarbonSource();

  it("returns 0 for empty inputs", () => {
    // Act & Assert
    expect(source.calculate([])).toBe(0);
  });

  it("applies DEVICE_FACTOR per second of load time", () => {
    // Act — 2 000 ms = 2 s
    const result = source.calculate([input({ pageLoadDurationMs: 2_000 })]);

    // Assert
    expect(result).toBeCloseTo(2 * DEVICE_FACTOR, 10);
  });

  it("sums the duration across several inputs", () => {
    // Act
    const result = source.calculate([
      input({ pageLoadDurationMs: 2_000 }),
      input({ pageLoadDurationMs: 3_000 }),
    ]);

    // Assert
    expect(result).toBeCloseTo(5 * DEVICE_FACTOR, 10);
  });
});

describe("ScreenCarbonSource", () => {
  const source = new ScreenCarbonSource();

  it("returns 0 for empty inputs", () => {
    // Act & Assert
    expect(source.calculate([])).toBe(0);
  });

  it("applies SCREEN_FACTOR per second the panel stayed lit", () => {
    // Act — 2 000 ms = 2 s
    const result = source.calculate([input({ pageLoadDurationMs: 2_000 })]);

    // Assert
    expect(result).toBeCloseTo(2 * SCREEN_FACTOR, 10);
  });

  it("charges less than the rest of the machine, as the sourced split says", () => {
    // Act & Assert — 3.4 W of panel against 8.0 W of CPU and GPU
    expect(SCREEN_FACTOR).toBeLessThan(DEVICE_FACTOR);
  });
});

describe("computeAvoidedCarbon", () => {
  it("returns 0 when the cache served nothing", () => {
    // Act & Assert
    expect(computeAvoidedCarbon([input({ transferredBytes: ONE_GB })])).toBe(0);
  });

  it("prices cached bytes at the network factor they spared", () => {
    // Act
    const result = computeAvoidedCarbon([input({ cachedBytes: ONE_GB })]);

    // Assert
    expect(result).toBeCloseTo(CARBON_PER_GB, 10);
  });

  it("adds up across inputs and stays positive", () => {
    // Act
    const result = computeAvoidedCarbon([
      input({ cachedBytes: ONE_GB / 2 }),
      input({ cachedBytes: ONE_GB / 2 }),
    ]);

    // Assert
    expect(result).toBeCloseTo(CARBON_PER_GB, 10);
    expect(result).toBeGreaterThan(0);
  });
});
