import type { SobrietyColor, SobrietyLevel } from "../carbon/sobriety";
import { SOBRIETY_COLOR, gradeSobrietyLevel } from "../carbon/sobriety";
import type { Translations } from "../i18n/types";
import type { DailyRecordReader } from "../session/types";

/**
 * Badge paint, in the Tailwind **700** family — not the 500 the panel's
 * surfaces use. The badge is the only place a solid fill carries white text,
 * and white on a 500 sits near 2:1. The 700 family clears WCAG AA on both
 * engines with the badge text colour left at each engine's default, so no
 * `setBadgeTextColor` call is needed and Chromium and Gecko cannot diverge.
 *
 * Which colour a grade wears is not decided here — `SOBRIETY_COLOR` owns that,
 * beside the grade itself. This table only says how that colour is mixed for
 * this medium.
 */
const HEX: Record<SobrietyColor, string> = {
  green: "#15803d",
  yellow: "#a16207",
  orange: "#c2410c",
  red: "#b91c1c",
};

export const SOBRIETY_HEX: Record<SobrietyLevel, string> = {
  sober: HEX[SOBRIETY_COLOR.sober],
  moderate: HEX[SOBRIETY_COLOR.moderate],
  intensive: HEX[SOBRIETY_COLOR.intensive],
  excessive: HEX[SOBRIETY_COLOR.excessive],
};

/** Neutral grey, so an unmeasured day reads as "no data" and not as a grade. */
export const EMPTY_BADGE_COLOR = "#6b7280";

/** The dash a day with nothing measured wears — a badge with no text is invisible. */
const EMPTY_BADGE_TEXT = "–";

const GRAMS_PER_KILOGRAM = 1_000;
/** Above this, one decimal would render five characters and Chrome truncates. */
const MAX_DECIMAL_KILOGRAMS = 9.95;

/**
 * What fits in a badge: four characters at most.
 *
 * A total under a gram is shown as `<1` rather than rounded to `0`, because `0`
 * is how an unmeasured day is written and the two must not collide.
 *
 * O(1) time and space.
 */
export function formatBadgeText(totalCo2: number): string {
  if (totalCo2 === 0) return EMPTY_BADGE_TEXT;
  if (totalCo2 < 1) return "<1";
  if (totalCo2 < GRAMS_PER_KILOGRAM) return String(Math.round(totalCo2));

  const kilograms = totalCo2 / GRAMS_PER_KILOGRAM;
  return kilograms < MAX_DECIMAL_KILOGRAMS
    ? `${kilograms.toFixed(1)}k`
    : `${Math.round(kilograms)}k`;
}

export function resolveBadgeColor(level: SobrietyLevel): string {
  return SOBRIETY_HEX[level];
}

/**
 * The badge, as behaviour rather than as a `chrome.action` call: three writes,
 * so the grade can be asserted without a browser.
 */
export type BadgeSurface = {
  setText: (text: string) => void;
  setBackgroundColor: (color: string) => void;
  setTitle: (title: string) => void;
};

/** Two decimals under a gram, whole grams above — the badge has no room for either. */
function formatTooltipGrams(totalCo2: number): string {
  return totalCo2 < 1 ? totalCo2.toFixed(2) : String(Math.round(totalCo2));
}

/**
 * Rewrites the badge from the day currently stored.
 *
 * It has to run on every measure, at startup and after a reset: the badge does
 * not survive a browser restart, and a day that rolls over would otherwise keep
 * yesterday's grade on screen.
 *
 * The tooltip is the only place the figure appears with its unit and its grade
 * in words — the badge itself holds four characters, and a screen reader sees
 * neither the colour nor the digits.
 *
 * O(1) time and space beyond the stored day the reader returns.
 */
export async function refreshBadge(
  reader: DailyRecordReader,
  surface: BadgeSurface,
  translations: Translations,
): Promise<void> {
  const { totalCarbon } = await reader.getDailyRecord();
  const total = totalCarbon.totalCo2;

  surface.setText(formatBadgeText(total));

  if (total === 0) {
    surface.setBackgroundColor(EMPTY_BADGE_COLOR);
    surface.setTitle(translations.badge.tooltipEmpty);
    return;
  }

  const level = gradeSobrietyLevel(total);
  surface.setBackgroundColor(resolveBadgeColor(level));
  surface.setTitle(
    translations.badge.tooltip(formatTooltipGrams(total), translations.sobrietyLevels[level]),
  );
}
