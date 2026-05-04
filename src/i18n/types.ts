export type Language = "en" | "fr";

export type CarbonLevelKey = "sobre" | "modere" | "intensif" | "excessif";

export type EquivalenceTranslations = {
  emails: (n: number) => string;
  streamingMin: (n: number) => string;
  streamingH: (h: string) => string;
  car: (km: string) => string;
  flight: (km: string) => string;
};

export type WorldAvgTranslations = {
  below: (pct: number) => string;
  above: (pct: number) => string;
  equal: () => string;
};

export type Translations = {
  header: string;
  nav: { today: string; settings: string };
  noData: string;
  stats: {
    co2: string;
    data: string;
    requests: string;
    tabs: string;
  };
  chart: { title: string };
  carbonLevels: Record<CarbonLevelKey, string>;
  equivalences: EquivalenceTranslations;
  worldAvg: WorldAvgTranslations;
  settings: {
    save: string;
    saved: string;
    language: string;
  };
};
