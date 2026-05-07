import { describe, it, expect } from "vitest";
import { getCarbonLevel, getCarbonEquivalence, getWorldAverageComparison } from "./utils";
import { en } from "../../../i18n/en";
import { fr } from "../../../i18n/fr";

describe("getCarbonLevel", () => {
  it("returns green below 50g", () => {
    expect(getCarbonLevel(0).color).toBe("green");
    expect(getCarbonLevel(49.9).color).toBe("green");
    expect(getCarbonLevel(0).key).toBe("sobre");
  });

  it("returns yellow from 50g to 249g", () => {
    expect(getCarbonLevel(50).color).toBe("yellow");
    expect(getCarbonLevel(249.9).color).toBe("yellow");
    expect(getCarbonLevel(50).key).toBe("modere");
  });

  it("returns orange from 250g to 599g", () => {
    expect(getCarbonLevel(250).color).toBe("orange");
    expect(getCarbonLevel(599.9).color).toBe("orange");
    expect(getCarbonLevel(250).key).toBe("intensif");
  });

  it("returns red at 600g and above", () => {
    expect(getCarbonLevel(600).color).toBe("red");
    expect(getCarbonLevel(9999).color).toBe("red");
    expect(getCarbonLevel(600).key).toBe("excessif");
  });

  it("includes niveau badge for each level", () => {
    expect(getCarbonLevel(0).niveau).toBe("🥇");
    expect(getCarbonLevel(50).niveau).toBe("🥈");
    expect(getCarbonLevel(250).niveau).toBe("🥉");
    expect(getCarbonLevel(600).niveau).toBe("⛔");
  });
});

describe("getCarbonEquivalence — English", () => {
  const eq = en.equivalences;

  it("returns empty string for 0g", () => {
    expect(getCarbonEquivalence(0, eq)).toBe("");
  });

  it("returns email count below 1g", () => {
    expect(getCarbonEquivalence(0.3, eq)).toBe("≈ 1 email");
    expect(getCarbonEquivalence(0.9, eq)).toBe("≈ 3 emails");
  });

  it("returns streaming minutes from 1g to 54g (at 55g/h)", () => {
    // 27.5g / 55g/h * 60 min = 30 min
    expect(getCarbonEquivalence(27.5, eq)).toBe("≈ 30 min HD streaming");
    // 54g / 55g/h * 60 = 58.9 min → 59 min
    expect(getCarbonEquivalence(54, eq)).toBe("≈ 59 min HD streaming");
  });

  it("returns streaming hours from 55g to 549g", () => {
    // 55g / 55g/h = 1.0h
    expect(getCarbonEquivalence(55, eq)).toBe("≈ 1.0h HD streaming");
    // 110g / 55g/h = 2.0h
    expect(getCarbonEquivalence(110, eq)).toBe("≈ 2.0h HD streaming");
    // 528g / 55g/h = 9.6h
    expect(getCarbonEquivalence(528, eq)).toBe("≈ 9.6h HD streaming");
  });

  it("returns km by car from 550g to 5999g (at 120g/km)", () => {
    // 550g / 120g/km = 4.6km
    expect(getCarbonEquivalence(550, eq)).toBe("≈ 4.6 km by car");
    // 1200g / 120g/km = 10.0km
    expect(getCarbonEquivalence(1200, eq)).toBe("≈ 10.0 km by car");
  });

  it("returns km by plane at 6000g and above (at 230g/km)", () => {
    // 6000g / 230g/km = 26.1km
    expect(getCarbonEquivalence(6000, eq)).toBe("≈ 26.1 km by plane");
    // 11500g / 230g/km = 50.0km
    expect(getCarbonEquivalence(11500, eq)).toBe("≈ 50.0 km by plane");
  });
});

describe("getCarbonEquivalence — French", () => {
  const eq = fr.equivalences;

  it("returns streaming minutes in French word order", () => {
    expect(getCarbonEquivalence(27.5, eq)).toBe("≈ 30 min streaming HD");
  });

  it("returns streaming hours in French", () => {
    expect(getCarbonEquivalence(110, eq)).toBe("≈ 2.0h streaming HD");
  });

  it("returns km en voiture in French", () => {
    expect(getCarbonEquivalence(550, eq)).toBe("≈ 4.6 km en voiture");
  });

  it("returns km en avion in French", () => {
    expect(getCarbonEquivalence(6000, eq)).toBe("≈ 26.1 km en avion");
  });
});

describe("getWorldAverageComparison", () => {
  const wa = en.worldAvg;

  it("returns empty string for 0g", () => {
    expect(getWorldAverageComparison(0, wa)).toBe("");
  });

  it("returns below message when under world average (120g)", () => {
    // 60g = 50% below 120g
    expect(getWorldAverageComparison(60, wa)).toBe("−50% vs. world avg (120 g/d)");
  });

  it("returns above message when over world average", () => {
    // 180g = 50% above 120g
    expect(getWorldAverageComparison(180, wa)).toBe("+50% vs. world avg (120 g/d)");
  });

  it("returns equal message when exactly at world average", () => {
    expect(getWorldAverageComparison(120, wa)).toBe("= world avg (120 g/d)");
  });

  it("works in French", () => {
    const waFr = fr.worldAvg;
    expect(getWorldAverageComparison(60, waFr)).toBe("−50% vs. moy. mondiale (120 g/j)");
    expect(getWorldAverageComparison(180, waFr)).toBe("+50% vs. moy. mondiale (120 g/j)");
  });
});
