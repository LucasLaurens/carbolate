import type { CarbonEstimate } from "../carbon/types";
import { sumCarbonEstimates, sumMetrics } from "./aggregator";
import type { DailyRecord, DailyRecordsStore, MetricTab, Metrics } from "./types";

/**
 * Reads records written by earlier versions, without rewriting storage.
 *
 * Three carbon shapes have been persisted: `cpuCo2` alone, then `cpuCo2` +
 * `renderingCo2`, now `deviceCo2`. The first two split one duration across two
 * coefficients, so their **sum is exactly** today's device figure — the merge
 * loses nothing going backwards. `avoidedCo2` and `cachedPageWeight` never
 * existed and cannot be recovered from what was stored: zero is the only value
 * that invents nothing.
 *
 * Normalising here, at the single point where stored bytes become domain objects,
 * is what lets every reader downstream — the sums, the CSV, the panel — treat
 * every field as present. Those fallbacks used to be scattered as `?? 0` across
 * three modules, and each of them was one field behind.
 * See docs/decisions/2026-08-05-perimetre-modele-carbone.md
 */
type StoredCarbon = Partial<CarbonEstimate> & {
  cpuCo2?: number;
  renderingCo2?: number;
};

type StoredMetrics = Partial<Metrics> & {
  cpuTimeToLoad?: number;
};

type StoredTab = Omit<MetricTab, "metrics" | "carbon"> & {
  metrics?: StoredMetrics;
  carbon?: StoredCarbon;
};

type StoredRecord = Omit<DailyRecord, "tabs" | "totalMetrics" | "totalCarbon"> & {
  tabs?: StoredTab[];
  totalMetrics?: StoredMetrics;
  totalCarbon?: StoredCarbon;
};

const numberOr = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) ? fallback : value;

function normalizeCarbon(carbon: StoredCarbon = {}): CarbonEstimate {
  const networkCo2 = numberOr(carbon.networkCo2, 0);
  const deviceCo2 = numberOr(
    carbon.deviceCo2,
    numberOr(carbon.cpuCo2, 0) + numberOr(carbon.renderingCo2, 0),
  );

  return {
    networkCo2,
    deviceCo2,
    // Recomputed rather than trusted: a legacy total happens to be the same
    // number, but a record half-written by an interrupted update would otherwise
    // carry a total its own parts do not add up to.
    totalCo2: networkCo2 + deviceCo2,
    avoidedCo2: numberOr(carbon.avoidedCo2, 0),
  };
}

function normalizeMetrics(metrics: StoredMetrics = {}): Metrics {
  return {
    requestCount: numberOr(metrics.requestCount, 0),
    totalResourceSize: numberOr(metrics.totalResourceSize, 0),
    pageLoadDurationSec: numberOr(metrics.pageLoadDurationSec, numberOr(metrics.cpuTimeToLoad, 0)),
    cachedPageWeight: numberOr(metrics.cachedPageWeight, 0),
  };
}

/**
 * O(n) time and space — n = tabs in the record. The day's totals are rebuilt from
 * the normalised tabs rather than normalised on their own, so a stored total that
 * disagrees with its parts is corrected instead of carried forward.
 */
export function normalizeDailyRecord(record: StoredRecord): DailyRecord {
  const tabs = (record.tabs ?? []).map((tab) => ({
    ...tab,
    metrics: normalizeMetrics(tab.metrics),
    carbon: normalizeCarbon(tab.carbon),
  }));

  return {
    date: record.date,
    tabs,
    totalMetrics: sumMetrics(tabs.map((tab) => tab.metrics)),
    totalCarbon: sumCarbonEstimates(tabs.map((tab) => tab.carbon)),
  };
}

/**
 * O(n) time and space — n = tabs across every stored day. Paid once per storage
 * read; the metrics store caches today's record, so a panel that stays open does
 * not repeat it.
 */
export function normalizeDailyRecords(stored: DailyRecordsStore): DailyRecordsStore {
  return Object.fromEntries(
    Object.entries(stored).map(([date, record]) => [date, normalizeDailyRecord(record)]),
  );
}
