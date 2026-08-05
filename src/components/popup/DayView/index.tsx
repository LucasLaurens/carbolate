import type { DailyRecord } from "../../../session/types";
import type { Translations } from "../../../i18n/types";
import { StatsGrid } from "./StatsGrid";
import { DomainChart } from "./DomainChart";

type Props = {
  record: DailyRecord;
  onRefresh: () => void;
  isLoading?: boolean;
  t: Translations;
};

export default function DayView({ record, isLoading = false, t }: Props) {
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
    </div>
  );
}
