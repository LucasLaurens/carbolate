import { COLOR_CLASSES, formatCo2, getCarbonLevel, type CarbonLevel } from "./utils";
import type { StatColor } from "./types";
import type { CarbonEstimate } from "../../../carbon/types";
import type { Metrics } from "../../../session/types";

type StatCardProps = {
  value: string;
  label: string;
  color: StatColor;
  badge?: Pick<CarbonLevel, "niveau" | "name">;
};

function StatCard({ value, label, color, badge }: StatCardProps) {
  const cls = COLOR_CLASSES[color];
  return (
    <div className={`${cls.bg} rounded-lg p-3 text-center`}>
      {badge && <div className="text-lg mb-1">{badge.niveau}</div>}
      <div className={`text-2xl font-bold ${cls.value}`}>{value}</div>
      <div className={`text-xs ${cls.label}`}>{label}</div>
      {badge && <div className={`text-xs mt-1 font-medium ${cls.label}`}>{badge.name}</div>}
    </div>
  );
}

type StatsGridProps = {
  totalCarbon: CarbonEstimate;
  totalMetrics: Metrics;
  tabCount: number;
};

export function StatsGrid({ totalCarbon, totalMetrics, tabCount }: StatsGridProps) {
  const level = getCarbonLevel(totalCarbon.totalCo2);
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        value={`${formatCo2(totalCarbon.totalCo2)}g`}
        label="Estimated CO₂"
        color={level.color}
        badge={level}
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
