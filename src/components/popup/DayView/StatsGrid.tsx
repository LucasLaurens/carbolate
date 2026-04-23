import { COLOR_CLASSES, formatCo2, getCarbonLevel, getCarbonEquivalence } from "./utils";
import type { StatColor } from "./types";
import type { CarbonEstimate } from "../../../carbon/types";
import type { Metrics } from "../../../session/types";
import type { Translations } from "../../../i18n/types";

type StatCardProps = {
  value: string;
  label: string;
  color: StatColor;
  badge?: { niveau: string; name: string };
  sub?: string;
};

function StatCard({ value, label, color, badge, sub }: StatCardProps) {
  const cls = COLOR_CLASSES[color];
  return (
    <div className={`${cls.bg} rounded-xl p-3.5 text-center shadow-sm`}>
      {badge && (
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <span className="text-base leading-none">{badge.niveau}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cls.badge}`}>
            {badge.name}
          </span>
        </div>
      )}
      <div className={`text-2xl font-bold leading-tight ${cls.value}`}>{value}</div>
      <div className={`text-xs mt-0.5 ${cls.label}`}>{label}</div>
      {sub && <div className={`text-xs mt-1.5 font-medium opacity-70 ${cls.label}`}>{sub}</div>}
    </div>
  );
}

type StatsGridProps = {
  totalCarbon: CarbonEstimate;
  totalMetrics: Metrics;
  tabCount: number;
  t: Translations;
};

export function StatsGrid({ totalCarbon, totalMetrics, tabCount, t }: StatsGridProps) {
  const level = getCarbonLevel(totalCarbon.totalCo2);
  const equivalence = getCarbonEquivalence(totalCarbon.totalCo2, t.equivalences);
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        value={`${formatCo2(totalCarbon.totalCo2)}g`}
        label={t.stats.co2}
        color={level.color}
        badge={{ niveau: level.niveau, name: t.carbonLevels[level.key] }}
        sub={equivalence}
      />
      <StatCard
        value={`${totalMetrics.totalResourceSize.toFixed(1)}MB`}
        label={t.stats.data}
        color="blue"
      />
      <StatCard value={String(totalMetrics.requestCount)} label={t.stats.requests} color="blue" />
      <StatCard value={String(tabCount)} label={t.stats.tabs} color="blue" />
    </div>
  );
}
