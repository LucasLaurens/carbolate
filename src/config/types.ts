import type { Language } from "../i18n/types";

export type Preferences = {
  /**
   * Local days of history kept, and the **single source of truth** for retention:
   * `1` = today only, `7` = a rolling week, `-1` = keep everything. The reset
   * alarm's period derives from it — see `computeResetPeriodMinutes`.
   */
  retentionDays: number;
  autoExportBeforeReset: boolean;
  language: Language;
};
