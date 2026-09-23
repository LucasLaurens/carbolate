import type { PageVisit } from "../../../session/types";
import type { StatColor, DomainData } from "./types";
import type { EquivalenceTranslations, WorldComparisonTranslations } from "../../../i18n/types";
import type { SobrietyLevel } from "../../../carbon/sobriety";
import { SOBRIETY_COLOR, gradeSobrietyLevel } from "../../../carbon/sobriety";
import { compareToDailyReference } from "../../../carbon/worldComparison";

/**
 * Domains are ranked by CO₂, so the palette is a ramp: the green accent on the
 * heaviest, fading to stone. Amber and red are sobriety grades in this panel; a
 * red slice would read as a verdict on a domain that is merely third.
 * Tailwind green-700, green-500, green-300, stone-400, stone-300.
 */
export const CHART_COLORS = ["#15803d", "#22c55e", "#86efac", "#a8a29e", "#d6d3d1"];

/**
 * Labels and badge text sit on their own tint, not on white: the 600 shade on a
 * 50 background measures about 3:1, under AA for text this small. The 700 label
 * and the 800 badge text clear 4.5:1 on every tint.
 */
export const COLOR_CLASSES: Record<
  StatColor,
  { bg: string; value: string; label: string; badge: string; border: string }
> = {
  green: {
    bg: "bg-green-50",
    value: "text-green-700",
    label: "text-green-700",
    badge: "bg-green-100 text-green-800",
    border: "border-green-200",
  },
  yellow: {
    bg: "bg-yellow-50",
    value: "text-yellow-700",
    label: "text-yellow-700",
    badge: "bg-yellow-100 text-yellow-800",
    border: "border-yellow-200",
  },
  orange: {
    bg: "bg-orange-50",
    value: "text-orange-700",
    label: "text-orange-700",
    badge: "bg-orange-100 text-orange-800",
    border: "border-orange-200",
  },
  red: {
    bg: "bg-red-50",
    value: "text-red-700",
    label: "text-red-700",
    badge: "bg-red-100 text-red-800",
    border: "border-red-200",
  },
  blue: {
    bg: "bg-blue-50",
    value: "text-blue-700",
    label: "text-blue-700",
    badge: "bg-blue-100 text-blue-800",
    border: "border-blue-200",
  },
};

/**
 * How each grade is painted **in the panel**. Neither the thresholds nor the
 * colour is decided here: `carbon/sobriety.ts` owns both, so the icon badge and
 * this card cannot end up disagreeing on what colour a grade wears. What is
 * local is the medal and the Tailwind mixing — the badge paints the same colour
 * as a hex.
 */
const LEVEL_MEDALS: Record<SobrietyLevel, string> = {
  sober: "🥇",
  moderate: "🥈",
  intensive: "🥉",
  excessive: "⛔",
};

export type CarbonLevel = { color: StatColor; badge: string; level: SobrietyLevel };

export function getCarbonLevel(totalCo2: number): CarbonLevel {
  const level = gradeSobrietyLevel(totalCo2);
  return { color: SOBRIETY_COLOR[level], badge: LEVEL_MEDALS[level], level };
}

export function formatCo2(value: number): string {
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

// Reference values
// ADEME 2023: email without attachment ≈ 0.3 gCO₂e
const EMAIL_G = 0.3;
// IEA 2022 / BBC Carbon Trust: HD (1080p) streaming ≈ 55 gCO₂e/h
const STREAMING_HD_G_PER_H = 55;
// ADEME 2022: average European passenger car ≈ 120 gCO₂e/km
const CAR_G_PER_KM = 120;
// ADEME 2023: short-haul flight per passenger including radiative forcing ≈ 230 gCO₂e/km
const FLIGHT_G_PER_KM = 230;

export function getCarbonEquivalence(gCO2: number, eq: EquivalenceTranslations): string {
  if (gCO2 === 0) return "";
  if (gCO2 < 1) {
    const n = Math.max(1, Math.round(gCO2 / EMAIL_G));
    return eq.emails(n);
  }
  if (gCO2 < STREAMING_HD_G_PER_H) {
    const min = Math.round((gCO2 / STREAMING_HD_G_PER_H) * 60);
    return eq.streamingMin(min);
  }
  if (gCO2 < 10 * STREAMING_HD_G_PER_H) {
    return eq.streamingH((gCO2 / STREAMING_HD_G_PER_H).toFixed(1));
  }
  if (gCO2 < 50 * CAR_G_PER_KM) {
    return eq.car((gCO2 / CAR_G_PER_KM).toFixed(1));
  }
  return eq.flight((gCO2 / FLIGHT_G_PER_KM).toFixed(1));
}

/**
 * Empty on a day with nothing measured: "well below the average" would be a
 * verdict on an absence of data.
 */
export function getWorldComparisonLabel(gCO2: number, labels: WorldComparisonTranslations): string {
  if (gCO2 === 0) return "";
  return labels[compareToDailyReference(gCO2)];
}

/** O(n) time and space — n = visits. One pass, indexed by domain. */
export function aggregateDomains(visits: readonly PageVisit[]): DomainData[] {
  const perDomain = new Map<string, number>();
  for (const visit of visits) {
    perDomain.set(visit.domain, (perDomain.get(visit.domain) ?? 0) + visit.carbon.totalCo2);
  }
  return Array.from(perDomain.entries()).map(([domain, totalCo2]) => ({ domain, totalCo2 }));
}
