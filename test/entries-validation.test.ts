import { describe, it, expect } from "vitest";
import PageMetricsValidator from "../src/performance/PageMetricsValidator";
import { PerformanceEntryType } from "../src/performance/enums/PerformanceEntryType";

describe("PageMetricsValidator", () => {
  it("validates when at least one entry type is present", () => {
    const validator = new PageMetricsValidator({
      [PerformanceEntryType.RESOURCE]: [{ name: "https://example.com/script.js" }],
    } as never);
    expect(validator.validate()).toBe(true);
  });

  it("rejects an empty entries object", () => {
    const validator = new PageMetricsValidator({} as never);
    expect(validator.validate()).toBe(false);
  });

  it("rejects entries where all arrays are empty", () => {
    const validator = new PageMetricsValidator({
      [PerformanceEntryType.RESOURCE]: [],
      [PerformanceEntryType.NAVIGATION]: [],
    } as never);
    expect(validator.validate()).toBe(false);
  });

  it("returns a descriptive message", () => {
    const validator = new PageMetricsValidator({} as never);
    expect(validator.message()).toMatch(/entries/i);
  });
});
