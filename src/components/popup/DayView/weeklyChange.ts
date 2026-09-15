import type { DailyRecord } from "../../../session/types";
import { toDailyDate } from "../../../utils/clock";
import { WEEK_LENGTH } from "./weekBars";

/**
 * The change between the seven days ending today and the seven before them.
 *
 * Sliding, not calendar: the bars above this figure are a sliding window, and a
 * calendar week would compare a set of days the chart does not draw. It would
 * also compare a Tuesday to a full week, making every reading negative from
 * Monday to Saturday without anything changing in the browsing.
 *
 * A **change, never a grade**: `gradeSobrietyLevel` derives its thresholds from a
 * daily reference, so a seven-day total cannot wear a sobriety badge without a
 * weekly anchor — a carbon-model decision this is not.
 * See docs/decisions/2026-09-15-comparaison-hebdomadaire.md
 */
export type WeeklyChange =
  | { comparable: false }
  | { comparable: true; currentTotal: number; previousTotal: number; ratio: number };

const shiftDays = (from: Date, days: number): Date => {
  const shifted = new Date(from);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

const sumBetween = (records: readonly DailyRecord[], from: string, to: string): number =>
  records
    .filter((record) => record.date >= from && record.date <= to)
    .reduce((sum, record) => sum + record.totalCarbon.totalCo2, 0);

/**
 * Both windows must be **covered** by storage, which is not the same as every day
 * being present: a day nobody browsed is a real zero, while a day before the
 * extension had anything stored is an absence of measurement. Only the earliest
 * stored date says which is which — so a gap inside the fortnight is counted as
 * quiet, and a fortnight that starts too late reports nothing at all.
 *
 * O(n) time, O(1) space — n = stored days.
 */
export function computeWeeklyChange(records: readonly DailyRecord[], today: Date): WeeklyChange {
  if (records.length === 0) return { comparable: false };

  const currentStart = toDailyDate(shiftDays(today, -(WEEK_LENGTH - 1)));
  const currentEnd = toDailyDate(today);
  const previousStart = toDailyDate(shiftDays(today, -(2 * WEEK_LENGTH - 1)));
  const previousEnd = toDailyDate(shiftDays(today, -WEEK_LENGTH));

  const earliest = records.reduce(
    (oldest, record) => (record.date < oldest ? record.date : oldest),
    currentEnd,
  );
  if (earliest > previousStart) return { comparable: false };

  const previousTotal = sumBetween(records, previousStart, previousEnd);
  // Nothing to express a ratio from: a week at zero makes every rise infinite.
  if (previousTotal === 0) return { comparable: false };

  const currentTotal = sumBetween(records, currentStart, currentEnd);
  return {
    comparable: true,
    currentTotal,
    previousTotal,
    ratio: (currentTotal - previousTotal) / previousTotal,
  };
}
