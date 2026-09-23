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
  isLoading: boolean;
  isExporting: boolean;
  exportFailed: boolean;
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
  isLoading,
  isExporting,
  exportFailed,
  t,
}: Props) {
  const loadCount = record.visits.length;

  return (
    <div
      aria-busy={isLoading}
      className={`flex flex-col gap-2.5 transition-opacity duration-150 motion-reduce:transition-none ${isLoading ? "opacity-60" : "opacity-100"}`}
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
        <p className="text-center text-stone-500 text-sm py-4">{t.noData}</p>
      )}

      {/* On the data, not on the preference: a user who just narrowed the window
          still has days until the next purge. */}
      {days.length > 1 && <WeekChart days={days} today={today} language={language} t={t} />}

      <button
        type="button"
        onClick={onExport}
        disabled={isExporting}
        aria-busy={isExporting}
        className="py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest bg-white border border-stone-200 text-stone-600 cursor-pointer transition-colors hover:border-stone-400 disabled:cursor-wait disabled:text-stone-500 disabled:hover:border-stone-200"
      >
        {isExporting ? t.actions.exporting : t.actions.export}
      </button>
      {exportFailed && (
        <p role="alert" className="text-xs text-red-700">
          {t.actions.exportFailed}
        </p>
      )}
    </div>
  );
}
