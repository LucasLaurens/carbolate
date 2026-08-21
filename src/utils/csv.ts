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

const CSV_MIME = "text/csv;charset=utf-8";

/**
 * `URL.createObjectURL` does not exist in a Chromium MV3 service worker — it was
 * left out to avoid leaks a worker cannot clean up — and that worker is where the
 * reset alarm fires. A data URL is the handle the downloads API takes there;
 * Chromium accepts one up to roughly 64 MB.
 *
 * Firefox's MV3 background is an event page with a DOM, so it keeps the blob
 * path. Hence a capability test rather than a browser test: each engine gets the
 * form it has, and neither is asked to sniff the other.
 *
 * The object URL is never revoked. MDN is explicit that it must not be revoked
 * before the download *completes*, and the alarm's event page may be torn down
 * moments after the download starts — so the browser reclaims it with the
 * context, which costs one CSV of memory and never a truncated file.
 */
function csvUrl(csv: string): string {
  if (typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(new Blob([csv], { type: CSV_MIME }));
  }
  return `data:${CSV_MIME},${encodeURIComponent(csv)}`;
}

/**
 * Resolves once the download has *started*; a later interruption (disk full,
 * user cancel) is not reported here. `runResetCycle` deletes days on that
 * resolution, so it is trading on the start, not on the finish.
 */
export function exportToCSV(records: readonly DailyRecord[], clock: Clock): Promise<void> {
  const url = csvUrl(toCSV(records));
  const filename = `carbolate-export-${clock.dailyDate()}.csv`;

  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename }, (downloadId) => {
      if (downloadId === undefined) {
        reject(new Error(chrome.runtime.lastError?.message ?? "download did not start"));
        return;
      }
      resolve();
    });
  });
}
