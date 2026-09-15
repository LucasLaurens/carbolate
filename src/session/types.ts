import type { CarbonEstimate } from "../carbon/types";

export type Metrics = {
  requestCount: number;
  /**
   * How many of `requestCount` came from another registrable domain. A count of
   * requests, not a share of bytes — see the third-party ADR for why the bytes
   * are not measurable.
   */
  thirdPartyRequests: number;
  /** Transferred data in base-10 megabytes — what crossed the network, compressed. */
  totalResourceSize: number;
  /**
   * Wall-clock seconds from navigation start to load end. Formerly named
   * `cpuTimeToLoad`, which promised a CPU measurement it never made: this is a
   * **proxy** for device activity, not a CPU reading.
   */
  pageLoadDurationSec: number;
  /**
   * Seconds the page was **visible**, the input of `screenCo2`. A tab loaded in
   * the background and never looked at reports zero: its network and CPU are
   * charged, its screen is not.
   */
  visibleDurationSec: number;
  /**
   * Uncompressed megabytes the cache served, so none of it crossed the network.
   * Unlike `totalResourceSize` this is a decoded size, because that is what the
   * transfer would have weighed had the cache missed — it feeds avoided CO₂ only,
   * never the footprint.
   */
  cachedPageWeight: number;
};

type MetaData = {
  /**
   * The document's `performance.timeOrigin` — when the page started, not when
   * the message arrived. An identity must be a property of the thing identified:
   * the arrival hour is a property of the message, and the living record will
   * send several messages per visit, all of which must land on the same one.
   */
  date: number;
};

/**
 * One page load. Identified by **`(tabId, meta.date, url)`**, each component
 * separating a case the others cannot: the document start separates two
 * reloads, the url separates SPA navigations that share a document, the tab id
 * separates the same page open twice.
 * See docs/decisions/2026-08-21-identite-de-la-visite-de-page.md
 */
export type PageVisit = {
  tabId: number;
  url: string;
  domain: string;
  metrics: Metrics;
  meta: MetaData;
  carbon: CarbonEstimate;
};

export type DailyRecord = {
  date: string; // ISO "YYYY-MM-DD"
  visits: PageVisit[];
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
export type PageVisitRecorder = {
  recordPageVisit: (visit: PageVisit) => Promise<void>;
};

/** What the reset alarm needs. */
export type RetentionEnforcer = {
  clearPastDays: (retentionDays: number) => Promise<void>;
};

export type MetricsStore = DailyRecordReader & PageVisitRecorder & RetentionEnforcer;
