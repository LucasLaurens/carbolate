import type { DailyRecord } from "../session/types";
import { clock } from "./clock";

const CSV_HEADERS = [
  "date",
  "domain",
  "url",
  "requestCount",
  "totalResourceSize_MB",
  "cpuTimeToLoad_s",
  "networkCo2_g",
  "cpuCo2_g",
  "renderingCo2_g",
  "totalCo2_g",
  "visitTimestamp",
].join(",");

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(records: DailyRecord[]): void {
  const rows = records.flatMap((record) =>
    record.tabs.map((tab) =>
      [
        escapeCSV(record.date),
        escapeCSV(tab.domain),
        escapeCSV(tab.url),
        escapeCSV(tab.metrics.requestCount),
        escapeCSV(tab.metrics.totalResourceSize.toFixed(4)),
        escapeCSV(tab.metrics.cpuTimeToLoad.toFixed(4)),
        escapeCSV(tab.carbon.networkCo2),
        escapeCSV(tab.carbon.cpuCo2),
        escapeCSV(tab.carbon.renderingCo2 ?? 0),
        escapeCSV(tab.carbon.totalCo2),
        escapeCSV(tab.meta.date),
      ].join(","),
    ),
  );

  const csvContent = [CSV_HEADERS, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const today = clock.dailyDate();
  // Firefox drops the blob as soon as the panel closes, so the URL is released
  // only once the download has been handed over to the browser.
  chrome.downloads.download({ url, filename: `carbolate-export-${today}.csv` }, () =>
    URL.revokeObjectURL(url),
  );
}
