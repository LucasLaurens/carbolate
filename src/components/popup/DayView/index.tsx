import type { DailyRecord } from "../../../session/types";
import type { Translations } from "../../../i18n/types";
import { StatsGrid } from "./StatsGrid";
import { DomainChart } from "./DomainChart";

type Props = {
  record: DailyRecord | null;
  onRefresh: () => void;
  isLoading?: boolean;
  t: Translations;
};

const EMPTY_CARBON = { networkCo2: 0, cpuCo2: 0, totalCo2: 0 };
const EMPTY_METRICS = { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 };

export default function DayView({ record, t }: Props) {
  const totalCarbon = record?.totalCarbon ?? EMPTY_CARBON;
  const totalMetrics = record?.totalMetrics ?? EMPTY_METRICS;
  const tabCount = record?.tabs.length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <StatsGrid totalCarbon={totalCarbon} totalMetrics={totalMetrics} tabCount={tabCount} t={t} />

      {record && tabCount > 0 ? (
        <DomainChart record={record} t={t} />
      ) : (
        <p className="text-center text-gray-400 text-sm py-4">{t.noData}</p>
      )}
    </div>
  );
}
