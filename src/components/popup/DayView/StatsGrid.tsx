import {
  COLOR_CLASSES,
  formatCo2,
  getCarbonLevel,
  getCarbonEquivalence,
  getWorldComparisonLabel,
} from "./utils";
import type { StatColor } from "./types";
import type { CarbonEstimate } from "../../../carbon/types";
import type { Metrics } from "../../../session/types";
import type { Translations } from "../../../i18n/types";

type StatCardProps = {
  value: string;
  label: string;
  note?: string;
  color: StatColor;
  badge?: { emoji: string; name: string };
  sub?: string;
  sub2?: string;
};

function StatCard({ value, label, note, color, badge, sub, sub2 }: StatCardProps) {
  const cls = COLOR_CLASSES[color];
  return (
    <div className={`${cls.bg} border ${cls.border} rounded-xl px-4 pt-4 pb-3.5 text-center`}>
      {badge && (
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <span aria-hidden="true" className="text-sm leading-none">
            {badge.emoji}
          </span>
          <span
            className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${cls.badge}`}
          >
            {badge.name}
          </span>
        </div>
      )}
      <div
        className={`text-[2.75rem] font-bold tracking-tight leading-none tabular-nums ${cls.value}`}
      >
        {value}
      </div>
      <div className={`text-[10px] font-semibold uppercase tracking-widest mt-2 ${cls.label}`}>
        {label}
      </div>
      {note && <div className="text-[10px] text-stone-500 mt-1.5">{note}</div>}
      {sub && <div className={`text-xs mt-3 font-medium ${cls.label}`}>{sub}</div>}
      {sub2 && <div className="text-[11px] mt-1 text-stone-600">{sub2}</div>}
    </div>
  );
}

type MetricsStripProps = {
  loadCount: number;
  totalMetrics: Metrics;
  t: Translations;
};

function MetricsStrip({ loadCount, totalMetrics, t }: MetricsStripProps) {
  const items = [
    { value: String(loadCount), label: t.stats.pageLoads },
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
          <div className="text-lg font-bold text-stone-800 leading-tight tabular-nums">
            {item.value}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5 px-1 leading-tight">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Shown only when the cache actually spared something. It is deliberately styled
 * apart from the footprint: it is what browsing *would* have cost, never a
 * deduction from what it did cost.
 */
function AvoidedRow({ avoidedCo2, t }: { avoidedCo2: number; t: Translations }) {
  if (avoidedCo2 === 0) return null;

  return (
    <div className="flex items-baseline justify-center gap-1.5 bg-white border border-stone-200 rounded-xl py-2.5">
      <span className="text-sm font-bold text-green-700 tabular-nums">
        −{formatCo2(avoidedCo2)}g
      </span>
      <span className="text-[10px] text-stone-500">{t.stats.avoided}</span>
    </div>
  );
}

/**
 * Shown only when the day actually met a third party. A count of **requests**:
 * a cross-origin resource whose server omits `Timing-Allow-Origin` reports zero
 * bytes, and only about a quarter of third-party requests send that header — a
 * byte share would quietly flatter the most closed trackers.
 * See docs/decisions/2026-09-15-poids-tiers.md
 */
function ThirdPartyRow({ totalMetrics, t }: { totalMetrics: Metrics; t: Translations }) {
  if (totalMetrics.thirdPartyRequests === 0) return null;

  return (
    <div className="flex items-baseline justify-center gap-1.5 bg-white border border-stone-200 rounded-xl py-2.5">
      <span className="text-[11px] text-stone-500">
        {t.stats.thirdParty(totalMetrics.thirdPartyRequests, totalMetrics.requestCount)}
      </span>
    </div>
  );
}

type StatsGridProps = {
  totalCarbon: CarbonEstimate;
  totalMetrics: Metrics;
  loadCount: number;
  t: Translations;
};

export function StatsGrid({ totalCarbon, totalMetrics, loadCount, t }: StatsGridProps) {
  const level = getCarbonLevel(totalCarbon.totalCo2);

  return (
    <div className="flex flex-col gap-2.5">
      <StatCard
        value={`${formatCo2(totalCarbon.totalCo2)}g`}
        label={t.stats.co2}
        note={t.stats.running}
        color={level.color}
        badge={{ emoji: level.badge, name: t.sobrietyLevels[level.level] }}
        sub={getCarbonEquivalence(totalCarbon.totalCo2, t.equivalences)}
        sub2={getWorldComparisonLabel(totalCarbon.totalCo2, t.worldComparison)}
      />
      <MetricsStrip loadCount={loadCount} totalMetrics={totalMetrics} t={t} />
      <ThirdPartyRow totalMetrics={totalMetrics} t={t} />
      <AvoidedRow avoidedCo2={totalCarbon.avoidedCo2} t={t} />
    </div>
  );
}
