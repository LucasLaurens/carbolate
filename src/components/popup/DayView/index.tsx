import type { DailyRecord } from "../../../session/types";
import type { Language, Translations } from "../../../i18n/types";
import { StatsGrid } from "./StatsGrid";
import { DomainChart } from "./DomainChart";
import { WeekChart } from "./WeekChart";

type Props = {
  record: DailyRecord;
  /** Every stored day, for the week section — the panel reads, it never writes. */
  days: readonly DailyRecord[];
  today: Date;
  language: Language;
  onExport: () => void;
  isLoading?: boolean;
  t: Translations;
};

/**
 * Export is the only action left here, and the caller rate-limits it. The Refresh
 * button that used to sit beside it is gone: the panel now follows storage as it
 * changes, and a live panel still offering to refresh teaches the user it is not
 * one. See docs/decisions/2026-09-15-enregistrement-vivant.md
 */
export default function DayView({
  record,
  days,
  today,
  language,
  onExport,
  isLoading = false,
  t,
}: Props) {
  const loadCount = record.visits.length;

  return (
    <div
      className={`flex flex-col gap-2.5 transition-opacity duration-150 ${isLoading ? "opacity-60" : "opacity-100"}`}
    >
      <StatsGrid
        totalCarbon={record.totalCarbon}
        totalMetrics={record.totalMetrics}
        loadCount={loadCount}
        t={t}
      />

      {loadCount > 0 ? (
        <DomainChart record={record} t={t} />
      ) : (
        <p className="text-center text-stone-400 text-sm py-4">{t.noData}</p>
      )}

      {/* On the data, not on the preference: a user who just narrowed the window
          still has days until the next purge. */}
      {days.length > 1 && <WeekChart days={days} today={today} language={language} t={t} />}

      <div className="flex">
        <button
          type="button"
          onClick={onExport}
          className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest bg-white border border-stone-200 text-stone-600 cursor-pointer transition-colors hover:border-stone-300"
        >
          {t.actions.export}
        </button>
      </div>
    </div>
  );
}
