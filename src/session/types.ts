import type { CarbonEstimate } from "../carbon/types";

export type Metrics = {
  requestCount: number;
  /** Transferred data in base-10 megabytes — what crossed the network, compressed. */
  totalResourceSize: number;
  /**
   * Wall-clock seconds from navigation start to load end. Formerly named
   * `cpuTimeToLoad`, which promised a CPU measurement it never made: this is a
   * **proxy** for device activity, not a CPU reading.
   */
  pageLoadDurationSec: number;
  /**
   * Uncompressed megabytes the cache served, so none of it crossed the network.
   * Unlike `totalResourceSize` this is a decoded size, because that is what the
   * transfer would have weighed had the cache missed — it feeds avoided CO₂ only,
   * never the footprint.
   */
  cachedPageWeight: number;
};

type MetaData = {
  date: number; // timestamp
};

export type MetricTab = {
  id: number;
  url: string;
  domain: string;
  metrics: Metrics;
  meta: MetaData;
  carbon: CarbonEstimate;
};

export type DailyRecord = {
  date: string; // ISO "YYYY-MM-DD"
  tabs: MetricTab[];
  totalMetrics: Metrics;
  totalCarbon: CarbonEstimate;
};

/**
 * Keyed by local day. The storage key stays `"sessions"` for backward
 * compatibility with installed extensions, but its content has always been
 * daily records — see docs/glossary.md.
 */
export type DailyRecordsStore = Record<string, DailyRecord>;

/** What the panel needs: reads only, never a write. */
export type DailyRecordReader = {
  getDailyRecord: () => Promise<DailyRecord>;
  getAllDays: () => Promise<DailyRecord[]>;
};

/** What the intake needs — and nothing more, so it cannot drop a day. */
export type TabMetricsRecorder = {
  recordTabMetrics: (tab: MetricTab) => Promise<void>;
};

/** What the reset alarm needs. */
export type RetentionEnforcer = {
  clearPastDays: (retentionDays: number) => Promise<void>;
};

export type MetricsStore = DailyRecordReader & TabMetricsRecorder & RetentionEnforcer;
