import type { MetricTab } from "../../../session/types";
import type { StatColor, DomainData } from "./types";

// green, orange, red, blue, purple
// export const CHART_COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];
// green, orange, red, blue, blue
export const CHART_COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#3b82f6"];

export const COLOR_CLASSES: Record<StatColor, { bg: string; value: string; label: string }> = {
  green: { bg: "bg-green-50", value: "text-green-700", label: "text-green-600" },
  yellow: { bg: "bg-yellow-50", value: "text-yellow-700", label: "text-yellow-600" },
  orange: { bg: "bg-orange-50", value: "text-orange-700", label: "text-orange-600" },
  red: { bg: "bg-red-50", value: "text-red-700", label: "text-red-600" },
  blue: { bg: "bg-blue-50", value: "text-blue-700", label: "text-blue-600" },
};

export function formatCo2(value: number): string {
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

export function aggregateDomains(tabs: MetricTab[]): DomainData[] {
  const map = new Map<string, number>();
  for (const tab of tabs) {
    map.set(tab.domain, (map.get(tab.domain) ?? 0) + tab.carbon.totalCo2);
  }
  return Array.from(map.entries()).map(([domain, totalCo2]) => ({ domain, totalCo2 }));
}
