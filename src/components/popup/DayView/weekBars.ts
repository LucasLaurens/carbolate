import type { DailyRecord } from "../../../session/types";
import type { Language } from "../../../i18n/types";
import type { SobrietyColor } from "../../../carbon/sobriety";
import { SOBRIETY_COLOR, gradeSobrietyLevel } from "../../../carbon/sobriety";
import { toDailyDate } from "../../../utils/clock";

/**
 * Seven days, not a window following `retentionDays`. At the panel's 288 usable
 * pixels a seventh of the row is 37 px — the only width where the value in grams
 * still fits above its bar. Thirty bars would be 8 px each, which is a second
 * chart to design, not a setting.
 */
export const WEEK_LENGTH = 7;

/** Below this, a bar carrying a real measurement would be invisible. */
const MIN_VISIBLE_PERCENT = 3;

const LOCALE: Record<Language, string> = { en: "en-GB", fr: "fr-FR" };

/**
 * A day with no bar is a day nobody browsed **or** a day the storage never held —
 * the panel cannot tell them apart, and neither can be drawn as a zero without
 * claiming a sober day that was never measured. Hence the discriminant rather
 * than a `totalCo2` of 0.
 */
export type WeekBar = { date: string; label: string; isToday: boolean } & (
  | { measured: true; totalCo2: number; color: SobrietyColor; heightPercent: number }
  | { measured: false }
);

const shiftDays = (from: Date, days: number): Date => {
  const shifted = new Date(from);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

/**
 * The seven dates ending today, oldest first, each carrying what storage holds
 * for it.
 *
 * The colour comes from `gradeSobrietyLevel`, the **daily** anchor — which is why
 * this builds one bar per day and never a grade on the week: the thresholds
 * derive from a day's reference. See docs/decisions/2026-08-05-niveaux-sobriete-et-reference-mondiale.md
 *
 * O(n + 7) time, O(n) space — n = stored days. The index is what keeps a lookup
 * per bar from being a scan per bar.
 */
export function buildWeekBars(
  records: readonly DailyRecord[],
  today: Date,
  language: Language,
): readonly WeekBar[] {
  const byDate = new Map(records.map((record) => [record.date, record]));
  const dates = Array.from({ length: WEEK_LENGTH }, (_, index) =>
    shiftDays(today, index - (WEEK_LENGTH - 1)),
  );
  const todayDate = toDailyDate(today);

  const totals = dates
    .map((date) => byDate.get(toDailyDate(date))?.totalCarbon.totalCo2)
    .filter((total): total is number => total !== undefined);
  const tallest = Math.max(...totals, 0);

  const weekday = new Intl.DateTimeFormat(LOCALE[language], { weekday: "short" });

  return dates.map((date) => {
    const key = toDailyDate(date);
    const head = { date: key, label: weekday.format(date), isToday: key === todayDate };
    const record = byDate.get(key);
    if (record === undefined) return { ...head, measured: false };

    const totalCo2 = record.totalCarbon.totalCo2;
    return {
      ...head,
      measured: true,
      totalCo2,
      color: SOBRIETY_COLOR[gradeSobrietyLevel(totalCo2)],
      heightPercent: Math.max(MIN_VISIBLE_PERCENT, Math.round((totalCo2 / tallest) * 100)),
    };
  });
}
