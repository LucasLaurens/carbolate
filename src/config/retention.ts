import { toDailyDate } from "../utils/clock";

/** `retentionDays` sentinel meaning "never drop a day". */
export const KEEP_EVERYTHING = -1;

const MINUTES_PER_DAY = 24 * 60;

/**
 * How often the reset alarm should fire, for a given retention window.
 *
 * **Derived, not configured.** `ResetPeriod` (`"daily" | "weekly"`) used to carry
 * this same knowledge next to `retentionDays`, which made the pair
 * `{ resetPeriod: "weekly", retentionDays: 1 }` representable and meaningless, and
 * left `-1` with no period at all. Deriving it means any window — 1, 7, 30, 60,
 * `-1` — needs no new enum case.
 *
 * A one-day window, and "keep everything", are checked daily. A longer window is
 * checked once per window, which is the cadence the removed enum expressed: the
 * behaviour of the two shipped values does not move.
 * See docs/decisions/2026-08-05-unites-et-retention.md
 *
 * O(1) time and space.
 */
export function computeResetPeriodMinutes(retentionDays: number): number {
  if (retentionDays <= 1) return MINUTES_PER_DAY;
  return retentionDays * MINUTES_PER_DAY;
}

/** The windows the panel offers, widest last. Any number stays representable. */
export const RETENTION_OPTIONS = [1, 7, KEEP_EVERYTHING] as const;

export type RetentionOption = (typeof RETENTION_OPTIONS)[number];

/**
 * Whether a stored day survives a given retention window.
 *
 * **The single home of the cutoff rule.** It used to live only inside
 * `clearPastDays`, as `date >= cutoff` against `today - retentionDays` — which
 * keeps the cutoff day itself, so every window was one day too wide: "7 days"
 * stored eight. Invisible while `retentionDays` was immutable at `1` and no view
 * counted days; the panel control and the history views make it countable.
 *
 * Now that the panel must also announce how many days a shrink destroys, the rule
 * has two callers and one representation.
 *
 * O(1) time and space.
 */
export function isKept(date: string, retentionDays: number, today: Date): boolean {
  if (retentionDays === KEEP_EVERYTHING) return true;
  if (date === toDailyDate(today)) return true;

  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() - (retentionDays - 1));
  return date >= toDailyDate(earliest);
}
