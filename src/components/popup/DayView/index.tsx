import type { DailyRecord } from "../../../session/types";
import type { Translations } from "../../../i18n/types";
import { StatsGrid } from "./StatsGrid";
import { DomainChart } from "./DomainChart";

type Props = {
  record: DailyRecord;
  onRefresh: () => void;
  onExport: () => void;
  isLoading?: boolean;
  t: Translations;
};

/**
 * Both actions are reachable from here, and both are rate-limited by the caller.
 *
 * Refresh is not a convenience: the panel is a side panel on Chromium and a
 * sidebar on Gecko, so it stays mounted while the user keeps browsing and its
 * figures go stale the moment the next page loads. Export is what the `downloads`
 * permission is requested for.
 */
export default function DayView({ record, onRefresh, onExport, isLoading = false, t }: Props) {
  const tabCount = record.tabs.length;

  return (
    <div
      className={`flex flex-col gap-2.5 transition-opacity duration-150 ${isLoading ? "opacity-60" : "opacity-100"}`}
    >
      <StatsGrid
        totalCarbon={record.totalCarbon}
        totalMetrics={record.totalMetrics}
        tabCount={tabCount}
        t={t}
      />

      {tabCount > 0 ? (
        <DomainChart record={record} t={t} />
      ) : (
        <p className="text-center text-stone-400 text-sm py-4">{t.noData}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest bg-white border border-stone-200 text-stone-600 cursor-pointer transition-colors hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.actions.refresh}
        </button>
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
