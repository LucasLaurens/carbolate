import { describe, it, expect } from "vitest";
import CarbonCalculator from "../src/carbon/CarbonCalculator";
import { NetworkCarbonSource } from "../src/carbon/sources/NetworkCarbonSource";
import { CpuCarbonSource } from "../src/carbon/sources/CpuCarbonSource";
import { RenderingCarbonSource } from "../src/carbon/sources/RenderingCarbonSource";
import { CARBON_PER_GB, CPU_FACTOR, RENDERING_FACTOR } from "../src/carbon/constants";

describe("CarbonCalculator", () => {
  const calc = new CarbonCalculator();

  it("returns zero carbon for an empty input array", () => {
    expect(calc.calculate([])).toEqual({ networkCo2: 0, cpuCo2: 0, renderingCo2: 0, totalCo2: 0 });
  });

  it("calculates network CO2 from transfer size (1 GB)", () => {
    // networkCo2 = 1 GB * CARBON_PER_GB (176.8) = 176.8
    const result = calc.calculate([{ transferSize: 1_000_000_000, cpuTime: 0 }]);
    expect(result.networkCo2).toBe(CARBON_PER_GB);
    expect(result.cpuCo2).toBe(0);
    expect(result.renderingCo2).toBe(0);
    expect(result.totalCo2).toBe(CARBON_PER_GB);
  });

  it("calculates CPU CO2 from cpu time (1 000 000 ms = 1 000 s)", () => {
    // cpuCo2 = 1000 s * 0.001 = 1
    const result = calc.calculate([{ transferSize: 0, cpuTime: 1_000_000 }]);
    expect(result.cpuCo2).toBe((1_000_000 / 1000) * CPU_FACTOR);
    expect(result.networkCo2).toBe(0);
    expect(result.totalCo2).toBeCloseTo(result.cpuCo2 + result.renderingCo2, 10);
  });

  it("calculates rendering CO2 from cpu time (1 000 000 ms = 1 000 s)", () => {
    // renderingCo2 = 1000 s * 0.0004 = 0.4
    const result = calc.calculate([{ transferSize: 0, cpuTime: 1_000_000 }]);
    expect(result.renderingCo2).toBe((1_000_000 / 1000) * RENDERING_FACTOR);
  });

  it("sums transfer sizes across multiple entries", () => {
    const result = calc.calculate([
      { transferSize: 500_000_000, cpuTime: 0 },
      { transferSize: 500_000_000, cpuTime: 0 },
    ]);
    expect(result.networkCo2).toBe(CARBON_PER_GB);
  });

  it("combines all sources in totalCo2", () => {
    const result = calc.calculate([{ transferSize: 1_000_000_000, cpuTime: 1_000_000 }]);
    expect(result.totalCo2).toBeCloseTo(
      result.networkCo2 + result.cpuCo2 + result.renderingCo2,
      10,
    );
  });
});

describe("NetworkCarbonSource", () => {
  const source = new NetworkCarbonSource();

  it("returns 0 for empty inputs", () => {
    expect(source.calculate([])).toBe(0);
  });

  it("applies CARBON_PER_GB to transferred bytes", () => {
    // 2 GB → 2 * 176.8 = 353.6
    const result = source.calculate([{ transferSize: 2_000_000_000, cpuTime: 0 }]);
    expect(result).toBeCloseTo(2 * CARBON_PER_GB, 10);
  });
});

describe("CpuCarbonSource", () => {
  const source = new CpuCarbonSource();

  it("returns 0 for empty inputs", () => {
    expect(source.calculate([])).toBe(0);
  });

  it("applies CPU_FACTOR per second of load time", () => {
    // 2000 ms = 2 s → 2 * 0.001 = 0.002
    const result = source.calculate([{ transferSize: 0, cpuTime: 2000 }]);
    expect(result).toBeCloseTo(2 * CPU_FACTOR, 10);
  });
});

describe("RenderingCarbonSource", () => {
  const source = new RenderingCarbonSource();

  it("returns 0 for empty inputs", () => {
    expect(source.calculate([])).toBe(0);
  });

  it("applies RENDERING_FACTOR per second of load time", () => {
    // 5000 ms = 5 s → 5 * 0.0004 = 0.002
    const result = source.calculate([{ transferSize: 0, cpuTime: 5000 }]);
    expect(result).toBeCloseTo(5 * RENDERING_FACTOR, 10);
  });

  it("sums cpuTime across multiple entries", () => {
    const result = source.calculate([
      { transferSize: 0, cpuTime: 2000 },
      { transferSize: 0, cpuTime: 3000 },
    ]);
    expect(result).toBeCloseTo(5 * RENDERING_FACTOR, 10);
  });
});
