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
export function resetPeriodMinutes(retentionDays: number): number {
  if (retentionDays <= 1) return MINUTES_PER_DAY;
  return retentionDays * MINUTES_PER_DAY;
}
