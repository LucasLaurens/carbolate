import { describe, it, expect } from "vitest";
import ResourceStrategy from "../src/performance/ResourceStrategy";

describe("ResourceStrategy", () => {
  const strategy = new ResourceStrategy();

  it("returns zeros for an empty resource list", () => {
    const result = strategy.handle([]);
    expect(result.resourceCount).toBe(0);
    expect(result.totalTransferSize).toBe(0);
  });

  it("counts resources and sums their transfer sizes", () => {
    const result = strategy.handle([{ transferSize: 1_024 }, { transferSize: 2_048 }]);
    expect(result.resourceCount).toBe(2);
    expect(result.totalTransferSize).toBe(3_072);
  });

  it("handles a single resource", () => {
    const result = strategy.handle([{ transferSize: 512 }]);
    expect(result.resourceCount).toBe(1);
    expect(result.totalTransferSize).toBe(512);
  });
});
