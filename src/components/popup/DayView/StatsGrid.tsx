import {
  COLOR_CLASSES,
  formatCo2,
  getCarbonLevel,
  getCarbonEquivalence,
  getWorldAverageComparison,
} from "./utils";
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
  sub2?: string;
};

function StatCard({ value, label, color, badge, sub, sub2 }: StatCardProps) {
  const cls = COLOR_CLASSES[color];
  return (
    <div className={`${cls.bg} border ${cls.border} rounded-xl px-4 pt-4 pb-3.5 text-center`}>
      {badge && (
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <span className="text-sm leading-none">{badge.niveau}</span>
          <span
            className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${cls.badge}`}
          >
            {badge.name}
          </span>
        </div>
      )}
      <div className={`text-[2.75rem] font-bold tracking-tight leading-none ${cls.value}`}>
        {value}
      </div>
      <div className={`text-[10px] font-semibold uppercase tracking-widest mt-2 ${cls.label}`}>
        {label}
      </div>
      {sub && <div className={`text-xs mt-3 font-medium ${cls.label}`}>{sub}</div>}
      {sub2 && <div className={`text-[11px] mt-1 opacity-70 ${cls.label}`}>{sub2}</div>}
    </div>
  );
}

type MetricsStripProps = {
  tabCount: number;
  totalMetrics: Metrics;
  t: Translations;
};

function MetricsStrip({ tabCount, totalMetrics, t }: MetricsStripProps) {
  const items = [
    { value: String(tabCount), label: t.stats.tabs },
    { value: String(totalMetrics.requestCount), label: t.stats.requests },
    { value: `${totalMetrics.totalResourceSize.toFixed(1)} MB`, label: t.stats.data },
  ];

  return (
    <div className="flex bg-white border border-stone-200 rounded-xl overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex-1 py-3 text-center min-w-0 ${i > 0 ? "border-l border-stone-200" : ""}`}
        >
          <div className="text-lg font-bold text-stone-800 leading-tight">{item.value}</div>
          <div className="text-[10px] text-stone-400 mt-0.5 px-1 leading-tight">{item.label}</div>
        </div>
      ))}
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
  const worldAvg = getWorldAverageComparison(totalCarbon.totalCo2, t.worldAvg);
  return (
    <div className="flex flex-col gap-2.5">
      <StatCard
        value={`${formatCo2(totalCarbon.totalCo2)}g`}
        label={t.stats.co2}
        color={level.color}
        badge={{ niveau: level.niveau, name: t.carbonLevels[level.key] }}
        sub={equivalence}
        sub2={worldAvg}
      />
      <MetricsStrip tabCount={tabCount} totalMetrics={totalMetrics} t={t} />
    </div>
  );
}
