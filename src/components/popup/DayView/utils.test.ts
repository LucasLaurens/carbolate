import { describe, it, expect } from "vitest";
import { getCarbonLevel } from "./utils";

describe("getCarbonLevel", () => {
  it("returns green below 50g", () => {
    expect(getCarbonLevel(0).color).toBe("green");
    expect(getCarbonLevel(49.9).color).toBe("green");
    expect(getCarbonLevel(0).name).toBe("Sobre");
  });

  it("returns yellow from 50g to 249g", () => {
    expect(getCarbonLevel(50).color).toBe("yellow");
    expect(getCarbonLevel(249.9).color).toBe("yellow");
    expect(getCarbonLevel(50).name).toBe("Modéré");
  });

  it("returns orange from 250g to 599g", () => {
    expect(getCarbonLevel(250).color).toBe("orange");
    expect(getCarbonLevel(599.9).color).toBe("orange");
    expect(getCarbonLevel(250).name).toBe("Intensif");
  });

  it("returns red at 600g and above", () => {
    expect(getCarbonLevel(600).color).toBe("red");
    expect(getCarbonLevel(9999).color).toBe("red");
    expect(getCarbonLevel(600).name).toBe("Excessif");
  });

  it("includes niveau badge for each level", () => {
    expect(getCarbonLevel(0).niveau).toBe("🥇");
    expect(getCarbonLevel(50).niveau).toBe("🥈");
    expect(getCarbonLevel(250).niveau).toBe("🥉");
    expect(getCarbonLevel(600).niveau).toBe("⛔");
  });
});
