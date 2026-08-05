import type { DailyRecord } from "../../../session/types";
import type { Translations } from "../../../i18n/types";
import { emptyMetrics, emptyCarbonEstimate } from "../../../session/aggregator";
import { StatsGrid } from "./StatsGrid";
import { DomainChart } from "./DomainChart";

type Props = {
  record: DailyRecord | null;
  onRefresh: () => void;
  isLoading?: boolean;
  t: Translations;
};

export default function DayView({ record, isLoading = false, t }: Props) {
  const totalCarbon = record?.totalCarbon ?? emptyCarbonEstimate();
  const totalMetrics = record?.totalMetrics ?? emptyMetrics();
  const tabCount = record?.tabs.length ?? 0;

  return (
    <div
      className={`flex flex-col gap-2.5 transition-opacity duration-150 ${isLoading ? "opacity-60" : "opacity-100"}`}
    >
      <StatsGrid totalCarbon={totalCarbon} totalMetrics={totalMetrics} tabCount={tabCount} t={t} />

      {record && tabCount > 0 ? (
        <DomainChart record={record} t={t} />
      ) : (
        <p className="text-center text-stone-400 text-sm py-4">{t.noData}</p>
      )}
    </div>
  );
}
