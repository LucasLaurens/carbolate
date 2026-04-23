import { describe, it, expect } from "vitest";
import { getCarbonLevel, getCarbonEquivalence } from "./utils";
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

  it("returns streaming minutes from 1g to 35g", () => {
    expect(getCarbonEquivalence(18, eq)).toBe("≈ 30 min HD streaming");
    expect(getCarbonEquivalence(35, eq)).toBe("≈ 58 min HD streaming");
  });

  it("returns streaming hours from 36g to 599g", () => {
    expect(getCarbonEquivalence(36, eq)).toBe("≈ 1.0h HD streaming");
    expect(getCarbonEquivalence(72, eq)).toBe("≈ 2.0h HD streaming");
    expect(getCarbonEquivalence(599, eq)).toBe("≈ 16.6h HD streaming");
  });

  it("returns km by plane at 600g and above", () => {
    expect(getCarbonEquivalence(600, eq)).toBe("≈ 4.6 km by plane");
    expect(getCarbonEquivalence(1000, eq)).toBe("≈ 7.7 km by plane");
  });
});

describe("getCarbonEquivalence — French", () => {
  const eq = fr.equivalences;

  it("returns streaming minutes in French word order", () => {
    expect(getCarbonEquivalence(18, eq)).toBe("≈ 30 min streaming HD");
  });

  it("returns streaming hours in French", () => {
    expect(getCarbonEquivalence(72, eq)).toBe("≈ 2.0h streaming HD");
  });

  it("returns km en avion in French", () => {
    expect(getCarbonEquivalence(600, eq)).toBe("≈ 4.6 km en avion");
  });
});
