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
  "thirdPartyRequests",
  "totalResourceSize_MB",
  "pageLoadDuration_s",
  "visibleDuration_s",
  "cachedPageWeight_MB",
  "networkCo2_g",
  "deviceCo2_g",
  "screenCo2_g",
  "totalCo2_g",
  "avoidedCo2_g",
  // The document's start, not the hour the measurement was filed — see the
  // page-visit identity ADR. Same epoch milliseconds as before, to within a
  // second on every record written before the change.
  "visitTimestamp",
].join(",");

const DECIMALS = 4;

/** What a spreadsheet reads as the opening of a formula rather than as text. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Disarms a field a spreadsheet would execute instead of display.
 *
 * Excel, LibreOffice and Sheets evaluate a cell starting with `=`, `+`, `-` or
 * `@`; `=cmd|'…'!A1` is the classic. No field written today can start that way —
 * every one is a date, a host, an `http` URL or a number — so this guards the
 * shape of the file, not a known hole: the day a column carries anything the
 * page had a say in, the export must already be inert.
 *
 * A value the spreadsheet would read as a number is left alone, which is what
 * keeps a negative measurement a number rather than the text `'-1.5000`.
 *
 * O(1) time and space.
 */
function neutralizeFormula(value: string): string {
  if (!FORMULA_LEAD.test(value)) return value;
  return Number.isNaN(Number(value)) ? `'${value}` : value;
}

function escapeCSV(value: string | number): string {
  const str = neutralizeFormula(String(value));
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Every record handed here has been normalised by the metrics store, so no field
 * needs a fallback.
 *
 * O(n) time and space — n = total visits across every exported day.
 */
export function toCSV(records: readonly DailyRecord[]): string {
  const rows = records.flatMap((record) =>
    record.visits.map((visit) =>
      [
        escapeCSV(record.date),
        escapeCSV(visit.domain),
        escapeCSV(visit.url),
        escapeCSV(visit.metrics.requestCount),
        escapeCSV(visit.metrics.thirdPartyRequests),
        escapeCSV(visit.metrics.totalResourceSize.toFixed(DECIMALS)),
        escapeCSV(visit.metrics.pageLoadDurationSec.toFixed(DECIMALS)),
        escapeCSV(visit.metrics.visibleDurationSec.toFixed(DECIMALS)),
        escapeCSV(visit.metrics.cachedPageWeight.toFixed(DECIMALS)),
        escapeCSV(visit.carbon.networkCo2),
        escapeCSV(visit.carbon.deviceCo2),
        escapeCSV(visit.carbon.screenCo2),
        escapeCSV(visit.carbon.totalCo2),
        escapeCSV(visit.carbon.avoidedCo2),
        escapeCSV(visit.meta.date),
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
function buildCsvUrl(csv: string): string {
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
  const url = buildCsvUrl(toCSV(records));
  const filename = `carbolate-export-${clock.readDailyDate()}.csv`;

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
