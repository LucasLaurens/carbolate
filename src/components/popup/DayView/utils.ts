import type { MetricTab } from "../../../session/types";
import type { StatColor, DomainData } from "./types";
import type {
  CarbonLevelKey,
  EquivalenceTranslations,
  WorldAvgTranslations,
} from "../../../i18n/types";
import { WORLD_DAILY_BROWSING_G_CO2 } from "../../../carbon/constants";

// green, orange, red, blue, blue
export const CHART_COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#3b82f6"];

export const COLOR_CLASSES: Record<
  StatColor,
  { bg: string; value: string; label: string; badge: string }
> = {
  green: {
    bg: "bg-green-50",
    value: "text-green-700",
    label: "text-green-600",
    badge: "bg-green-100 text-green-700",
  },
  yellow: {
    bg: "bg-yellow-50",
    value: "text-yellow-700",
    label: "text-yellow-600",
    badge: "bg-yellow-100 text-yellow-700",
  },
  orange: {
    bg: "bg-orange-50",
    value: "text-orange-700",
    label: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
  },
  red: {
    bg: "bg-red-50",
    value: "text-red-700",
    label: "text-red-600",
    badge: "bg-red-100 text-red-700",
  },
  blue: {
    bg: "bg-blue-50",
    value: "text-blue-700",
    label: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
};

export type CarbonLevel = { color: StatColor; niveau: string; key: CarbonLevelKey };

const CARBON_LEVELS: Array<{ maxCo2: number } & CarbonLevel> = [
  { maxCo2: 50, color: "green", niveau: "🥇", key: "sobre" },
  { maxCo2: 250, color: "yellow", niveau: "🥈", key: "modere" },
  { maxCo2: 600, color: "orange", niveau: "🥉", key: "intensif" },
  { maxCo2: Infinity, color: "red", niveau: "⛔", key: "excessif" },
];

export function getCarbonLevel(totalCo2: number): CarbonLevel {
  return CARBON_LEVELS.find(({ maxCo2 }) => totalCo2 < maxCo2)!;
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

export function getWorldAverageComparison(gCO2: number, t: WorldAvgTranslations): string {
  if (gCO2 === 0) return "";
  const diff = gCO2 - WORLD_DAILY_BROWSING_G_CO2;
  const pct = Math.round((Math.abs(diff) / WORLD_DAILY_BROWSING_G_CO2) * 100);
  if (diff < 0) return t.below(pct);
  if (diff > 0) return t.above(pct);
  return t.equal();
}

export function aggregateDomains(tabs: MetricTab[]): DomainData[] {
  const map = new Map<string, number>();
  for (const tab of tabs) {
    map.set(tab.domain, (map.get(tab.domain) ?? 0) + tab.carbon.totalCo2);
  }
  return Array.from(map.entries()).map(([domain, totalCo2]) => ({ domain, totalCo2 }));
}
