import { describe, it, expect } from "vitest";
import CarbonCalculator from "./CarbonCalculator";

describe("CarbonCalculator", () => {
  const calc = new CarbonCalculator();

  it("returns zero carbon for an empty input array", () => {
    expect(calc.calculate([])).toEqual({ networkCo2: 0, cpuCo2: 0, totalCo2: 0 });
  });

  it("calculates network CO2 from transfer size (1 GB)", () => {
    // networkCo2 = 1 GB * 442 g/GB * 0.75 = 331.5 → rounded to 332
    const result = calc.calculate([{ transferSize: 1_000_000_000, cpuTime: 0 }]);
    expect(result.networkCo2).toBe(332);
    expect(result.cpuCo2).toBe(0);
    expect(result.totalCo2).toBe(332);
  });

  it("calculates CPU CO2 from cpu time (1 000 000 ms = 1 000 s)", () => {
    // cpuCo2 = 1000 s * 0.012 = 12
    const result = calc.calculate([{ transferSize: 0, cpuTime: 1_000_000 }]);
    expect(result.cpuCo2).toBe(12);
    expect(result.networkCo2).toBe(0);
    expect(result.totalCo2).toBe(12);
  });

  it("sums transfer sizes and cpu times across multiple entries", () => {
    // Same as 1 GB + 0 CPU → same result as the single-entry test
    const result = calc.calculate([
      { transferSize: 500_000_000, cpuTime: 0 },
      { transferSize: 500_000_000, cpuTime: 0 },
    ]);
    expect(result.networkCo2).toBe(332);
  });

  it("combines network and CPU CO2 in totalCo2", () => {
    const result = calc.calculate([
      { transferSize: 1_000_000_000, cpuTime: 1_000_000 },
    ]);
    expect(result.totalCo2).toBe(result.networkCo2 + result.cpuCo2);
  });
});
