import type { RetentionOption } from "../config/retention";
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
    /**
     * Page **loads**, not pages: three F5 are three stored visits, and calling
     * them "3 pages visited" would be false. The stored unit is a page visit;
     * this statistic counts loads. Two things, two words.
     */
    pageLoads: string;
    avoided: string;
    /**
     * Says the figure is a counter, not a closed balance. Without it, a user who
     * reopens the panel and finds a higher number reads a bug — the totals only
     * ever grow until the day rolls over.
     */
    running: string;
  };
  chart: { title: string };
  /**
   * The seven-day section. `barTooltip` and `noMeasure` are the only channel a
   * screen reader has for a bar — the value above it is 9px of decoration to
   * everything else.
   */
  history: {
    title: string;
    barTooltip: (date: string, grams: string) => string;
    noMeasure: (date: string) => string;
    /**
     * A change, never a grade — a seven-day total cannot wear a sobriety badge,
     * whose thresholds derive from a daily reference. The sign is carried by the
     * text and the arrow, never by a colour: the day's card already spends the
     * panel's one judgement colour.
     */
    versusPreviousWeek: (percent: number) => string;
  };
  actions: { export: string };
  /**
   * The badge holds four characters, so the unit and the grade in words live
   * only here — and this tooltip is all a screen reader gets of either.
   */
  badge: {
    tooltip: (grams: string, level: string) => string;
    tooltipEmpty: string;
  };
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
     * wrong", `perimeter` answers "your number is low". `allocation` answers a
     * third — "then turning this off would save that" — which the screen share
     * makes reachable for the first time.
     */
    method: {
      summary: string;
      measurement: string;
      perimeter: string;
      allocation: string;
    };
    /**
     * Keyed by the window itself, so a new option cannot ship without its label
     * and no stringly key stands between the two.
     */
    retention: {
      label: string;
      options: Record<RetentionOption, string>;
      /**
       * The only sentence in the product that announces data loss. Two forms,
       * because with the export on the days leave the extension but not the
       * disk — saying "for good" there would be a lie the user hesitates over.
       */
      confirm: (days: number) => string;
      confirmWithExport: (days: number) => string;
    };
    autoExport: {
      label: string;
      hint: string;
    };
  };
};
