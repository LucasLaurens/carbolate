import { DAILY_BROWSING_REFERENCE_G_CO2, SOBRIETY_MULTIPLIERS } from "./constants";

/**
 * A normative grade on a day's total: it answers "am I where I should be?", not
 * "am I average?" — that second question is what the world comparison answers.
 */
export type SobrietyLevel = "sober" | "moderate" | "intensive" | "excessive";

/**
 * Ordered by ascending edge; anything above the last one is `excessive`.
 *
 * The edges are **derived** from the anchor, never written out. They used to be
 * the literals 50 / 250 / 600 sitting in the panel's helpers, with no source and
 * no relation to the reference the same card compared against — so the badge and
 * the comparison could contradict each other on screen.
 * See docs/decisions/2026-08-05-niveaux-sobriete-et-reference-mondiale.md
 */
const BANDS: ReadonlyArray<{ readonly upTo: number; readonly level: SobrietyLevel }> = [
  { upTo: DAILY_BROWSING_REFERENCE_G_CO2 * SOBRIETY_MULTIPLIERS.sober, level: "sober" },
  { upTo: DAILY_BROWSING_REFERENCE_G_CO2 * SOBRIETY_MULTIPLIERS.moderate, level: "moderate" },
  { upTo: DAILY_BROWSING_REFERENCE_G_CO2 * SOBRIETY_MULTIPLIERS.intensive, level: "intensive" },
];

/**
 * The paint names a grade wears. It lives beside the grade, not in the panel:
 * the badge needs the same knowledge in hex, and a second literal in a second
 * medium is how "sober is green" comes to disagree with itself. Each medium
 * mixes this name its own way — Tailwind classes in the panel, a hex in the
 * badge.
 */
export type SobrietyColor = "green" | "yellow" | "orange" | "red";

export const SOBRIETY_COLOR: Record<SobrietyLevel, SobrietyColor> = {
  sober: "green",
  moderate: "yellow",
  intensive: "orange",
  excessive: "red",
};

/** O(1) time and space — three comparisons at most. */
export function sobrietyLevel(totalCo2: number): SobrietyLevel {
  const band = BANDS.find(({ upTo }) => totalCo2 < upTo);
  return band === undefined ? "excessive" : band.level;
}
