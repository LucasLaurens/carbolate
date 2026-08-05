import type { DailyRecord } from "../session/types";
import type { Clock } from "./clock";

/**
 * Column names, in order.
 *
 * The previous header — `cpuTimeToLoad_s`, `cpuCo2_g`, `renderingCo2_g` — is
 * **abandoned, not versioned**: it had been unreachable from the panel until this
 * release, so no exported file in the wild depends on it. `deviceCo2_g` carries
 * what the two split columns added up to.
 * See docs/decisions/2026-08-05-perimetre-modele-carbone.md
 */
const CSV_HEADERS = [
  "date",
  "domain",
  "url",
  "requestCount",
  "totalResourceSize_MB",
  "pageLoadDuration_s",
  "cachedPageWeight_MB",
  "networkCo2_g",
  "deviceCo2_g",
  "totalCo2_g",
  "avoidedCo2_g",
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
 * Every record handed here has been normalised by the metrics store, so no field
 * needs a fallback.
 *
 * O(n) time and space — n = total tabs across every exported day.
 */
export function toCSV(records: readonly DailyRecord[]): string {
  const rows = records.flatMap((record) =>
    record.tabs.map((tab) =>
      [
        escapeCSV(record.date),
        escapeCSV(tab.domain),
        escapeCSV(tab.url),
        escapeCSV(tab.metrics.requestCount),
        escapeCSV(tab.metrics.totalResourceSize.toFixed(DECIMALS)),
        escapeCSV(tab.metrics.pageLoadDurationSec.toFixed(DECIMALS)),
        escapeCSV(tab.metrics.cachedPageWeight.toFixed(DECIMALS)),
        escapeCSV(tab.carbon.networkCo2),
        escapeCSV(tab.carbon.deviceCo2),
        escapeCSV(tab.carbon.totalCo2),
        escapeCSV(tab.carbon.avoidedCo2),
        escapeCSV(tab.meta.date),
      ].join(","),
    ),
  );

  return [CSV_HEADERS, ...rows].join("\n");
}

export function exportToCSV(records: readonly DailyRecord[], clock: Clock): void {
  const blob = new Blob([toCSV(records)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  // Firefox drops the blob as soon as the panel closes, so the URL is released
  // only once the download has been handed over to the browser.
  chrome.downloads.download({ url, filename: `carbolate-export-${clock.dailyDate()}.csv` }, () =>
    URL.revokeObjectURL(url),
  );
}
