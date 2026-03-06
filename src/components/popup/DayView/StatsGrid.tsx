import { COLOR_CLASSES, formatCo2 } from "./utils";
import type { StatColor } from "./types";
import type { CarbonEstimate } from "../../../carbon/types";
import type { Metrics } from "../../../session/types";

type StatCardProps = { value: string; label: string; color: StatColor };

function StatCard({ value, label, color }: StatCardProps) {
  const cls = COLOR_CLASSES[color];
  return (
    <div className={`${cls.bg} rounded-lg p-3 text-center`}>
      <div className={`text-2xl font-bold ${cls.value}`}>{value}</div>
      <div className={`text-xs ${cls.label}`}>{label}</div>
    </div>
  );
}

type StatsGridProps = {
  totalCarbon: CarbonEstimate;
  totalMetrics: Metrics;
  tabCount: number;
};

// todo: export in specific file
function calculateCritical(level: number): StatColor {
  switch (true) {
    case level >= 5 && level < 10:
      return "yellow";
    case level >= 10 && level < 15:
      return "orange";
    case level >= 15:
      return "red";
    default:
      return "green";
  }
}

export function StatsGrid({ totalCarbon, totalMetrics, tabCount }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        value={`${formatCo2(totalCarbon.totalCo2)}g`}
        label="Estimated CO₂"
        color={calculateCritical(totalCarbon.totalCo2)}
      />
      <StatCard
        value={`${totalMetrics.totalResourceSize.toFixed(1)}MB`}
        label="Data transferred"
        color="blue"
      />
      <StatCard value={String(totalMetrics.requestCount)} label="Requests" color="blue" />
      <StatCard value={String(tabCount)} label="Tabs visited" color="blue" />
    </div>
  );
}
