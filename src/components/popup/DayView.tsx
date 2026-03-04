import { Component } from "react";
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from "chart.js";
import type { DailyRecord } from "../../session/types";

Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

type Props = { record: DailyRecord | null; onRefresh: () => void };

type DomainData = { domain: string; totalCo2: number };

const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default class DayView extends Component<Props> {
  private chartRef: HTMLCanvasElement | null = null;
  private chartInstance: Chart | null = null;

  componentDidMount() {
    this.renderChart();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.record !== this.props.record) {
      this.renderChart();
    }
  }

  componentWillUnmount() {
    this.chartInstance?.destroy();
  }

  renderChart() {
    if (!this.chartRef || !this.props.record) return;
    this.chartInstance?.destroy();

    const domainMap = new Map<string, number>();
    for (const tab of this.props.record.tabs) {
      const existing = domainMap.get(tab.domain) ?? 0;
      domainMap.set(tab.domain, existing + tab.carbon.totalCo2);
    }

    const domains: DomainData[] = Array.from(domainMap.entries())
      .map(([domain, totalCo2]) => ({ domain, totalCo2 }))
      .sort((a, b) => b.totalCo2 - a.totalCo2)
      .slice(0, 5);

    if (domains.length === 0) return;

    this.chartInstance = new Chart(this.chartRef, {
      type: "doughnut",
      data: {
        labels: domains.map((d) => d.domain),
        datasets: [
          {
            data: domains.map((d) => d.totalCo2),
            backgroundColor: CHART_COLORS,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}g CO₂` },
          },
        },
      },
    });
  }

  render() {
    const { record, onRefresh } = this.props;
    const totalCarbon = record?.totalCarbon ?? { networkCo2: 0, cpuCo2: 0, totalCo2: 0 };
    const totalMetrics = record?.totalMetrics ?? { requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 };
    const tabCount = record?.tabs.length ?? 0;

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{totalCarbon.totalCo2}g</div>
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
            <canvas ref={(el) => { this.chartRef = el; }} height={160} />
          </div>
        )}

        {tabCount === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">Aucune donnée pour aujourd'hui</p>
        )}

        <button
          className="w-full p-2 rounded-md cursor-pointer text-white bg-blue-500 hover:bg-blue-700 text-sm"
          onClick={onRefresh}
        >
          🔄 Actualiser
        </button>
      </div>
    );
  }
}
