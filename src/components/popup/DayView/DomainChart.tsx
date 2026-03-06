import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { DailyRecord } from "../../../session/types";
import { CHART_COLORS, formatCo2, aggregateDomains } from "./utils";

function useChart(canvasRef: React.RefObject<HTMLCanvasElement | null>, record: DailyRecord) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const chartData = aggregateDomains(record.tabs)
      .filter((d) => Number.isFinite(d.totalCo2))
      .sort((a, b) => b.totalCo2 - a.totalCo2)
      .slice(0, 5);

    if (chartData.length === 0) return;

    const chart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: chartData.map((d) => d.domain),
        datasets: [
          {
            data: chartData.map((d) => Math.max(d.totalCo2, 0.001)),
            backgroundColor: CHART_COLORS,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const raw = chartData[ctx.dataIndex]?.totalCo2 ?? 0;
                return `${ctx.label}: ${formatCo2(raw)}g CO₂`;
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [canvasRef, record]);
}

type DomainChartProps = { record: DailyRecord };

export function DomainChart({ record }: DomainChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useChart(canvasRef, record);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Top domains by CO₂</h3>
      <div className="h-40 w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
