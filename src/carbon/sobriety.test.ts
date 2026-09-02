import { describe, it, expect } from "vitest";
import { gradeSobrietyLevel } from "./sobriety";
import type { SobrietyLevel } from "./sobriety";
import { DAILY_BROWSING_REFERENCE_G_CO2, SOBRIETY_MULTIPLIERS } from "./constants";

/** Small enough to sit strictly under an edge, large enough to survive floats. */
const JUST_UNDER = 0.001;

describe("every threshold is a multiple of the daily reference", () => {
  /**
   * The check the ADR asks for, and the reason it is written against behaviour
   * rather than against the constants: asserting
   * `threshold === reference × multiplier` would only restate the derivation and
   * could never fail. Asserting where the *grade* flips fails the moment a
   * literal — the 50 / 250 / 600 this replaced — is written back into the level
   * table, which is the regression that can actually happen.
   */
  const edges: ReadonlyArray<[SobrietyLevel, SobrietyLevel, number]> = [
    ["sober", "moderate", SOBRIETY_MULTIPLIERS.sober],
    ["moderate", "intensive", SOBRIETY_MULTIPLIERS.moderate],
    ["intensive", "excessive", SOBRIETY_MULTIPLIERS.intensive],
  ];

  it.each(edges)(
    "flips from %s to %s exactly at the reference × %d",
    (below, above, multiplier) => {
      // Arrange
      const edge = DAILY_BROWSING_REFERENCE_G_CO2 * multiplier;

      // Act & Assert
      expect(gradeSobrietyLevel(edge - JUST_UNDER)).toBe(below);
      expect(gradeSobrietyLevel(edge)).toBe(above);
    },
  );

  it("puts the edges where the ADR says, for the reference in force", () => {
    // Act & Assert — 120 × 0.5 / 1.5 / 4
    expect(DAILY_BROWSING_REFERENCE_G_CO2 * SOBRIETY_MULTIPLIERS.sober).toBe(60);
    expect(DAILY_BROWSING_REFERENCE_G_CO2 * SOBRIETY_MULTIPLIERS.moderate).toBe(180);
    expect(DAILY_BROWSING_REFERENCE_G_CO2 * SOBRIETY_MULTIPLIERS.intensive).toBe(480);
  });
});

describe("gradeSobrietyLevel", () => {
  it("grades a day with nothing measured as sober", () => {
    // Act & Assert
    expect(gradeSobrietyLevel(0)).toBe("sober");
  });

  it("grades an arbitrarily heavy day as excessive", () => {
    // Act & Assert
    expect(gradeSobrietyLevel(DAILY_BROWSING_REFERENCE_G_CO2 * 1_000)).toBe("excessive");
  });

  it("returns a level for every total, with no unmatched branch", () => {
    // Arrange
    const totals = [0, 1, 59.9, 60, 179.9, 180, 479.9, 480, 10_000];

    // Act
    const levels = totals.map(gradeSobrietyLevel);

    // Assert
    expect(levels.every((level) => level !== undefined)).toBe(true);
  });
});
