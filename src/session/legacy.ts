import type { CarbonEstimate } from "../carbon/types";
import { sumCarbonEstimates, sumMetrics } from "./aggregator";
import type { DailyRecord, DailyRecordsStore, PageVisit, Metrics } from "./types";

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

/**
 * `id` is the field name every version before the page-visit key wrote for the
 * tab it measured, and `tabs` the array that held them. Both are read here and
 * written under their new names, so the rename costs no migration.
 */
type StoredVisit = Omit<PageVisit, "tabId" | "metrics" | "carbon"> & {
  tabId?: number;
  id?: number;
  metrics?: StoredMetrics;
  carbon?: StoredCarbon;
};

type StoredRecord = Omit<DailyRecord, "visits" | "totalMetrics" | "totalCarbon"> & {
  visits?: StoredVisit[];
  tabs?: StoredVisit[];
  totalMetrics?: StoredMetrics;
  totalCarbon?: StoredCarbon;
};

const coalesceNumber = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) ? fallback : value;

function normalizeCarbon(carbon: StoredCarbon = {}): CarbonEstimate {
  const networkCo2 = coalesceNumber(carbon.networkCo2, 0);
  const deviceCo2 = coalesceNumber(
    carbon.deviceCo2,
    coalesceNumber(carbon.cpuCo2, 0) + coalesceNumber(carbon.renderingCo2, 0),
  );

  // Days stored before the split carry the whole machine in `deviceCo2`. They
  // are not retro-split: the share is unknowable per record, and a zero here
  // keeps the total the user already saw.
  const screenCo2 = coalesceNumber(carbon.screenCo2, 0);

  return {
    networkCo2,
    deviceCo2,
    screenCo2,
    // Recomputed rather than trusted: a legacy total happens to be the same
    // number, but a record half-written by an interrupted update would otherwise
    // carry a total its own parts do not add up to.
    totalCo2: networkCo2 + deviceCo2 + screenCo2,
    avoidedCo2: coalesceNumber(carbon.avoidedCo2, 0),
  };
}

function normalizeMetrics(metrics: StoredMetrics = {}): Metrics {
  return {
    requestCount: coalesceNumber(metrics.requestCount, 0),
    // Days written before resources were classified hold no count, and it cannot
    // be recovered: zero reads as "none seen", which is what the panel then shows.
    thirdPartyRequests: coalesceNumber(metrics.thirdPartyRequests, 0),
    totalResourceSize: coalesceNumber(metrics.totalResourceSize, 0),
    pageLoadDurationSec: coalesceNumber(
      metrics.pageLoadDurationSec,
      coalesceNumber(metrics.cpuTimeToLoad, 0),
    ),
    // Days written before the living record hold no visible time and cannot be
    // given one after the fact: zero invents nothing.
    visibleDurationSec: coalesceNumber(metrics.visibleDurationSec, 0),
    cachedPageWeight: coalesceNumber(metrics.cachedPageWeight, 0),
  };
}

/**
 * O(n) time and space — n = visits in the record. The day's totals are rebuilt
 * from the normalised visits rather than normalised on their own, so a stored total that
 * disagrees with its parts is corrected instead of carried forward.
 */
export function normalizeDailyRecord(record: StoredRecord): DailyRecord {
  const visits = (record.visits ?? record.tabs ?? []).map(({ id, ...visit }) => ({
    ...visit,
    tabId: coalesceNumber(visit.tabId, coalesceNumber(id, 0)),
    metrics: normalizeMetrics(visit.metrics),
    carbon: normalizeCarbon(visit.carbon),
  }));

  return {
    date: record.date,
    visits,
    totalMetrics: sumMetrics(visits.map((visit) => visit.metrics)),
    totalCarbon: sumCarbonEstimates(visits.map((visit) => visit.carbon)),
  };
}

/**
 * O(n) time and space — n = visits across every stored day. Paid once per storage
 * read; the metrics store caches today's record, so a panel that stays open does
 * not repeat it.
 */
export function normalizeDailyRecords(stored: DailyRecordsStore): DailyRecordsStore {
  return Object.fromEntries(
    Object.entries(stored).map(([date, record]) => [date, normalizeDailyRecord(record)]),
  );
}
