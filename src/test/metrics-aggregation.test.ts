import { describe, it, expect } from "vitest";
import { sumMetrics } from "../session/aggregator";

describe("sumMetrics", () => {
  it("returns zeros for an empty array", () => {
    expect(sumMetrics([])).toEqual({
      requestCount: 0,
      totalResourceSize: 0,
      cpuTimeToLoad: 0,
    });
  });

  it("returns the single entry unchanged", () => {
    const m = { requestCount: 5, totalResourceSize: 100, cpuTimeToLoad: 1.5 };
    expect(sumMetrics([m])).toEqual(m);
  });

  it("sums all fields across multiple metrics", () => {
    expect(
      sumMetrics([
        { requestCount: 5, totalResourceSize: 100, cpuTimeToLoad: 1.0 },
        { requestCount: 3, totalResourceSize: 200, cpuTimeToLoad: 0.5 },
      ]),
    ).toEqual({ requestCount: 8, totalResourceSize: 300, cpuTimeToLoad: 1.5 });
  });
});
