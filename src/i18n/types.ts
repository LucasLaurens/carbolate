import type { SobrietyLevel } from "../carbon/sobriety";
import type { WorldComparison } from "../carbon/worldComparison";

export type Language = "en" | "fr";

export type EquivalenceTranslations = {
  emails: (n: number) => string;
  streamingMin: (n: number) => string;
  streamingH: (h: string) => string;
  car: (km: string) => string;
  flight: (km: string) => string;
};

/**
 * One plain label per position — no parameter anywhere, because the comparison no
 * longer produces a number. It used to take a percentage, which is the false
 * precision the ADR removed.
 */
export type WorldComparisonTranslations = Record<WorldComparison, string>;

export type Translations = {
  header: string;
  nav: { today: string; settings: string; privacy: string };
  noData: string;
  stats: {
    co2: string;
    data: string;
    requests: string;
    tabs: string;
    avoided: string;
  };
  chart: { title: string };
  actions: { refresh: string; export: string };
  /** Keyed by the domain's own level names, so no French key hides in an English type. */
  sobrietyLevels: Record<SobrietyLevel, string>;
  equivalences: EquivalenceTranslations;
  worldComparison: WorldComparisonTranslations;
  settings: {
    save: string;
    saved: string;
    language: string;
    /**
     * What the product says about its own figure. Two distinct reasons, because
     * they answer two different objections: `measurement` answers "your number is
     * wrong", `perimeter` answers "your number is low".
     */
    method: {
      summary: string;
      measurement: string;
      perimeter: string;
    };
  };
};
