import { Component } from "react";
import Chart from "chart.js/auto";
import type { DailyRecord } from "../../session/types";

type Props = { record: DailyRecord | null; onRefresh: () => void; isLoading?: boolean };

type DomainData = { domain: string; totalCo2: number };

const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
const formatCo2 = (value: number): string => {
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(3);
};

export default class DayView extends Component<Props> {
  private chartRef: HTMLCanvasElement | null = null;
  private chartInstance: Chart | null = null;
  private rafId: number | null = null;

  componentDidMount() {
    this.scheduleRenderChart();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.record !== this.props.record) {
      this.scheduleRenderChart();
    }
  }

  componentWillUnmount() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.chartInstance?.destroy();
  }

  scheduleRenderChart() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.renderChart();
    });
  }

  renderChart() {
    if (!this.chartRef || !this.props.record) {
      this.chartInstance?.destroy();
      this.chartInstance = null;
      return;
    }
    this.chartInstance?.destroy();

    const domainMap = new Map<string, number>();
    for (const tab of this.props.record.tabs) {
      const existing = domainMap.get(tab.domain) ?? 0;
      domainMap.set(tab.domain, existing + tab.carbon.totalCo2);
    }

    const all: DomainData[] = Array.from(domainMap.entries()).map(([domain, totalCo2]) => ({
      domain,
      totalCo2,
    }));
    // Top-5 selection in O(n) using partial sort
    const K = 5;
    const domains: DomainData[] =
      all.length <= K
        ? all.sort((a, b) => b.totalCo2 - a.totalCo2)
        : (() => {
            const top: DomainData[] = [];
            for (const item of all) {
              if (top.length < K) {
                top.push(item);
                if (top.length === K) top.sort((a, b) => a.totalCo2 - b.totalCo2);
              } else if (item.totalCo2 > top[0].totalCo2) {
                top[0] = item;
                top.sort((a, b) => a.totalCo2 - b.totalCo2);
              }
            }
            return top.sort((a, b) => b.totalCo2 - a.totalCo2);
          })();

    const chartData = domains.filter((d) => Number.isFinite(d.totalCo2));
    if (chartData.length === 0) {
      this.chartInstance = null;
      return;
    }

    this.chartInstance = new Chart(this.chartRef, {
      type: "doughnut",
      data: {
        labels: chartData.map((d) => d.domain),
        datasets: [
          {
            data: chartData.map((d) => (d.totalCo2 > 0 ? d.totalCo2 : 0.001)),
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
  }

  render() {
    const { record } = this.props;
    const totalCarbon = record?.totalCarbon ?? { networkCo2: 0, cpuCo2: 0, totalCo2: 0 };
    const totalMetrics = record?.totalMetrics ?? {
      requestCount: 0,
      totalResourceSize: 0,
      cpuTimeToLoad: 0,
    };
    const tabCount = record?.tabs.length ?? 0;

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">
              {formatCo2(totalCarbon.totalCo2)}g
            </div>
            <div className="text-xs text-green-600">CO₂ estimé</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">
              {totalMetrics.totalResourceSize.toFixed(1)}MB
            </div>
            <div className="text-xs text-blue-600">Données transférées</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{totalMetrics.requestCount}</div>
            <div className="text-xs text-purple-600">Requêtes</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-700">{tabCount}</div>
            <div className="text-xs text-orange-600">Onglets visités</div>
          </div>
        </div>

        {tabCount > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Top domaines par CO₂</h3>
            <div className="h-40 w-full">
              <canvas
                className="h-full w-full"
                ref={(el) => {
                  this.chartRef = el;
                }}
              />
            </div>
          </div>
        )}

        {tabCount === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">Aucune donnée pour aujourd hui</p>
        )}

        {/* <button
          className={`w-full p-2 rounded-md text-white text-sm ${isLoading ? "bg-blue-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-700 cursor-pointer"}`}
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? "⏳ Updating..." : "🔄 Update"}
        </button> */}
      </div>
    );
  }
}
