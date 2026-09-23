import { describe, it, expect } from "vitest";
import {
  CHART_COLORS,
  getCarbonLevel,
  getCarbonEquivalence,
  getWorldComparisonLabel,
} from "./utils";
import { en } from "../../../i18n/en";
import { fr } from "../../../i18n/fr";
import { DAILY_BROWSING_REFERENCE_G_CO2, SOBRIETY_MULTIPLIERS } from "../../../carbon/constants";

const REFERENCE = DAILY_BROWSING_REFERENCE_G_CO2;

describe("getCarbonLevel", () => {
  it("paints a sober day green with a gold badge", () => {
    // Act
    const level = getCarbonLevel(0);

    // Assert
    expect(level).toEqual({ color: "green", badge: "🥇", level: "sober" });
  });

  it("paints each grade with its own colour", () => {
    // Arrange — one total per band, taken from the anchor rather than from literals
    const totals = [
      REFERENCE * SOBRIETY_MULTIPLIERS.sober,
      REFERENCE * SOBRIETY_MULTIPLIERS.moderate,
      REFERENCE * SOBRIETY_MULTIPLIERS.intensive,
    ];

    // Act
    const colors = totals.map((total) => getCarbonLevel(total).color);

    // Assert
    expect(colors).toEqual(["yellow", "orange", "red"]);
  });

  it("names the grade with the domain's own level, not a translation key", () => {
    // Act & Assert — the French keys "sobre"/"modere" used to leak into the type
    expect(getCarbonLevel(REFERENCE).level).toBe("moderate");
    expect(getCarbonLevel(REFERENCE * 10).level).toBe("excessive");
  });

  it("has a label in both languages for every grade it can return", () => {
    // Arrange
    const totals = [0, REFERENCE, REFERENCE * 2, REFERENCE * 10];

    // Act
    const levels = totals.map((total) => getCarbonLevel(total).level);

    // Assert
    expect(levels.every((level) => en.sobrietyLevels[level].length > 0)).toBe(true);
    expect(levels.every((level) => fr.sobrietyLevels[level].length > 0)).toBe(true);
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
    expect(getCarbonEquivalence(27.5, eq)).toBe("≈ 30 min HD streaming");
    expect(getCarbonEquivalence(54, eq)).toBe("≈ 59 min HD streaming");
  });

  it("returns streaming hours from 55g to 549g", () => {
    expect(getCarbonEquivalence(55, eq)).toBe("≈ 1.0h HD streaming");
    expect(getCarbonEquivalence(110, eq)).toBe("≈ 2.0h HD streaming");
    expect(getCarbonEquivalence(528, eq)).toBe("≈ 9.6h HD streaming");
  });

  it("returns km by car from 550g to 5999g (at 120g/km)", () => {
    expect(getCarbonEquivalence(550, eq)).toBe("≈ 4.6 km by car");
    expect(getCarbonEquivalence(1200, eq)).toBe("≈ 10.0 km by car");
  });

  it("returns km by plane at 6000g and above (at 230g/km)", () => {
    expect(getCarbonEquivalence(6000, eq)).toBe("≈ 26.1 km by plane");
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

describe("getWorldComparisonLabel", () => {
  it("says nothing on a day with nothing measured", () => {
    // Act & Assert — a verdict on an absence of data would be a lie
    expect(getWorldComparisonLabel(0, en.worldComparison)).toBe("");
  });

  it("states a position, never a percentage", () => {
    // Act
    const label = getWorldComparisonLabel(REFERENCE * 0.2, en.worldComparison);

    // Assert
    expect(label).toBe(en.worldComparison.wellBelow);
    expect(label).not.toMatch(/\d/);
  });

  it("moves through the positions as the day grows", () => {
    // Arrange
    const totals = [REFERENCE * 0.2, REFERENCE * 0.7, REFERENCE, REFERENCE * 1.5, REFERENCE * 3];

    // Act
    const labels = totals.map((total) => getWorldComparisonLabel(total, en.worldComparison));

    // Assert
    expect(labels).toEqual([
      en.worldComparison.wellBelow,
      en.worldComparison.below,
      en.worldComparison.around,
      en.worldComparison.above,
      en.worldComparison.wellAbove,
    ]);
  });

  it("works in French with no digit either", () => {
    // Act
    const label = getWorldComparisonLabel(REFERENCE * 3, fr.worldComparison);

    // Assert
    expect(label).toBe(fr.worldComparison.wellAbove);
    expect(label).not.toMatch(/\d/);
  });
});

/** HSL hue in degrees and saturation in [0, 1] of a `#rrggbb` colour. */
function readHueAndSaturation(hex: string): { hue: number; saturation: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0 };
  const lightness = (max + min) / 2;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const sector =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { hue: (sector * 60 + 360) % 360, saturation };
}

const GREEN_HUES = { from: 90, to: 160 };
const NEUTRAL_MAX_SATURATION = 0.15;

describe("CHART_COLORS", () => {
  it("spends no sobriety hue: every slice is the green accent or a neutral", () => {
    // Act
    const offenders = CHART_COLORS.filter((hex) => {
      const { hue, saturation } = readHueAndSaturation(hex);
      const isGreen = hue >= GREEN_HUES.from && hue <= GREEN_HUES.to;
      return !isGreen && saturation > NEUTRAL_MAX_SATURATION;
    });

    // Assert
    expect(offenders).toEqual([]);
  });

  it("gives every slice its own colour", () => {
    // Act & Assert
    expect(new Set(CHART_COLORS).size).toBe(CHART_COLORS.length);
  });
});
