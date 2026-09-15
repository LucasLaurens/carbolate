import type { DailyRecord } from "../../../session/types";
import type { Language, Translations } from "../../../i18n/types";
import type { SobrietyColor } from "../../../carbon/sobriety";
import { buildWeekBars } from "./weekBars";
import { computeWeeklyChange } from "./weeklyChange";
import { formatCo2 } from "./utils";

/**
 * Written out rather than built from the colour name: Tailwind compiles the
 * stylesheet from the class names it can **read** in the sources, so a class
 * assembled at runtime has no rule behind it and paints nothing.
 */
const BAR_CLASS: Record<SobrietyColor, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
};

const COLUMN_HEIGHT = "h-20";

type Props = { days: readonly DailyRecord[]; today: Date; language: Language; t: Translations };

/**
 * The week as seven bars, one per day, under the domain chart.
 *
 * A day with no measurement draws **no bar** and greys its label instead of
 * showing a zero: at this size a zero-height bar and a sober day look alike, and
 * only one of them is a fact. See docs/decisions/2026-09-15-graphique-hebdomadaire.md
 */
/**
 * One colour per state, never two classes of the same property: Tailwind emits
 * utilities in palette order, so `text-stone-400 text-stone-300` on one element
 * paints the 400 and the greyed-out day never looks greyed out.
 */
function labelClass(bar: { isToday: boolean; measured: boolean }): string {
  if (bar.isToday) return "font-bold text-stone-800";
  return bar.measured ? "text-stone-400" : "text-stone-300";
}

/**
 * Under the bars, in the same card: one more box would cost a border and 12px of
 * a 320px panel for a single line. Neutral by decision — the arrow carries the
 * direction, and the day's sobriety colour stays the panel's only verdict.
 */
function WeeklyChangeRow({ days, today, t }: Omit<Props, "language">) {
  const change = computeWeeklyChange(days, today);
  if (!change.comparable) return null;

  const percent = Math.round(change.ratio * 100);
  const arrow = percent > 0 ? "▲" : percent < 0 ? "▼" : "=";

  return (
    <div className="flex items-baseline justify-center gap-1.5 mt-3 pt-3 border-t border-stone-100">
      <span className="text-xs font-semibold text-stone-500">{arrow}</span>
      <span className="text-[11px] text-stone-500">{t.history.versusPreviousWeek(percent)}</span>
    </div>
  );
}

export function WeekChart({ days, today, language, t }: Props) {
  const bars = buildWeekBars(days, today, language);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <h3 className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
        {t.history.title}
      </h3>
      <div className={`flex items-end justify-between gap-1 ${COLUMN_HEIGHT}`}>
        {bars.map((bar) => (
          <div
            key={bar.date}
            className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
            title={
              bar.measured
                ? t.history.barTooltip(bar.date, formatCo2(bar.totalCo2))
                : t.history.noMeasure(bar.date)
            }
          >
            {bar.measured && (
              <>
                <span className="text-[9px] font-semibold text-stone-500 leading-none">
                  {formatCo2(bar.totalCo2)}
                </span>
                <div
                  className={`w-full rounded-t ${BAR_CLASS[bar.color]} ${
                    bar.isToday ? "outline-2 outline-offset-1 outline-stone-800" : ""
                  }`}
                  style={{ height: `${bar.heightPercent}%` }}
                />
              </>
            )}
            <span className={`text-[10px] leading-none ${labelClass(bar)}`}>{bar.label}</span>
          </div>
        ))}
      </div>
      <WeeklyChangeRow days={days} today={today} t={t} />
    </div>
  );
}
