import type { DailyRecord } from "../session/types";
import type { Clock } from "./clock";

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

const DECIMALS = 4;

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * O(n) time and space — n = total tabs across every exported day.
 */
export function toCSV(records: DailyRecord[]): string {
  const rows = records.flatMap((record) =>
    record.tabs.map((tab) =>
      [
        escapeCSV(record.date),
        escapeCSV(tab.domain),
        escapeCSV(tab.url),
        escapeCSV(tab.metrics.requestCount),
        escapeCSV(tab.metrics.totalResourceSize.toFixed(DECIMALS)),
        escapeCSV(tab.metrics.cpuTimeToLoad.toFixed(DECIMALS)),
        escapeCSV(tab.carbon.networkCo2),
        escapeCSV(tab.carbon.cpuCo2),
        // Days recorded before renderingCo2 existed have no such field.
        escapeCSV(tab.carbon.renderingCo2 ?? 0),
        escapeCSV(tab.carbon.totalCo2),
        escapeCSV(tab.meta.date),
      ].join(","),
    ),
  );

  return [CSV_HEADERS, ...rows].join("\n");
}

export function exportToCSV(records: DailyRecord[], clock: Clock): void {
  const blob = new Blob([toCSV(records)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  // Firefox drops the blob as soon as the panel closes, so the URL is released
  // only once the download has been handed over to the browser.
  chrome.downloads.download({ url, filename: `carbolate-export-${clock.dailyDate()}.csv` }, () =>
    URL.revokeObjectURL(url),
  );
}
