import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { DailyRecord } from "../../../session/types";
import type { Translations } from "../../../i18n/types";
import { CHART_COLORS, formatCo2, aggregateDomains } from "./utils";

const TOP_DOMAINS = 5;

/** A doughnut skips a zero slice entirely; the thinnest visible sliver stands in. */
const MIN_SLICE_CO2 = 0.001;

type DomainSlice = { domain: string; totalCo2: number };

function selectTopDomains(record: DailyRecord): DomainSlice[] {
  return aggregateDomains(record.visits)
    .filter((domain) => Number.isFinite(domain.totalCo2))
    .sort((a, b) => b.totalCo2 - a.totalCo2)
    .slice(0, TOP_DOMAINS);
}

/**
 * The chart is built **once** and fed afterwards.
 *
 * It used to be destroyed and reconstructed whenever `record` changed. Every
 * store read rebuilds that object, and a living visit writes every five seconds
 * per open tab — with seven tabs open the doughnut replayed its entry animation
 * roughly twice a second, which reads as a panel reloading rather than a figure
 * moving.
 */
function useChart(canvasRef: React.RefObject<HTMLCanvasElement | null>, record: DailyRecord) {
  const chartRef = useRef<Chart | null>(null);
  const slicesRef = useRef<DomainSlice[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const chart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [{ data: [], backgroundColor: CHART_COLORS, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 10 }, boxWidth: 10, padding: 8, color: "#78716c" },
          },
          tooltip: {
            callbacks: {
              // Read through the ref, not a captured array: the slices change
              // under a chart that is never rebuilt.
              label: (ctx) => {
                const raw = slicesRef.current[ctx.dataIndex]?.totalCo2 ?? 0;
                return `${ctx.label}: ${formatCo2(raw)}g CO₂`;
              },
            },
          },
        },
      },
    });

    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [canvasRef]);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) return;

    const slices = selectTopDomains(record);
    slicesRef.current = slices;
    chart.data.labels = slices.map((slice) => slice.domain);
    chart.data.datasets[0].data = slices.map((slice) => Math.max(slice.totalCo2, MIN_SLICE_CO2));
    // "none" — animating a figure that refreshes every few seconds is what made
    // it look like a reload.
    chart.update("none");
  }, [record]);
}

type DomainChartProps = { record: DailyRecord; t: Translations };

export function DomainChart({ record, t }: DomainChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useChart(canvasRef, record);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <h2
        id="domain-chart-title"
        className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-3"
      >
        {t.chart.title}
      </h2>
      <div className="h-36 w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby="domain-chart-title"
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
