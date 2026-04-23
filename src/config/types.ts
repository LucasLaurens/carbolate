import type { Language } from "../i18n/types";

export type ResetPeriod = "daily" | "weekly";

export type Preferences = {
  resetPeriod: ResetPeriod;
  retentionDays: number; // 1 | 7 | -1
  autoExportBeforeReset: boolean;
  language: Language;
};
