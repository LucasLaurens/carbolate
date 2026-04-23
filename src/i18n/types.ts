export type Language = "en" | "fr";

export type CarbonLevelKey = "sobre" | "modere" | "intensif" | "excessif";

export type EquivalenceTranslations = {
  emails: (n: number) => string;
  streamingMin: (n: number) => string;
  streamingH: (h: string) => string;
  flight: (km: string) => string;
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
  settings: {
    save: string;
    saved: string;
    language: string;
  };
};
