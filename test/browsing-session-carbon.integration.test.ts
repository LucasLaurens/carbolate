/**
 * End-to-end: what a content script observes → what lands in browser storage.
 *
 * The chain is the real one — MetricsCollector, MetricsIntake, the metrics store
 * and the real ChromeStorage adapter. Only the browser is replaced: the
 * Performance API by scripted entries, `chrome.storage.local` by the in-memory
 * backing in test/setup.ts.
 *
 * This file used to re-implement the background's transform in a local helper,
 * so a wiring mistake could not fail it. It now goes through the wiring.
 */
import { describe, it, expect, beforeEach } from "vitest";
import CarbonCalculator from "../src/carbon/CarbonCalculator";
import { MetricsCollector } from "../src/content/MetricsCollector";
import type { ObservationSink, PerformanceSource } from "../src/content/MetricsCollector";
import type {
  NavigationTiming,
  PagePerformancePayload,
  ResourceTiming,
} from "../src/performance/PageMetrics";
import { MetricsIntake } from "../src/intake/MetricsIntake";
import { createMetricsStore } from "../src/session/store";
import type { DailyRecord, MetricsStore } from "../src/session/types";
import { ChromeStorage } from "../src/storage/ChromeStorage";
import { FixedClock } from "./fakes/FixedClock";

const TODAY = "2026-02-23";

// ─── the browser's two halves, scripted ──────────────────────────────────────

class ScriptedPerformanceSource implements PerformanceSource {
  constructor(
    private readonly resourceEntries: ResourceTiming[],
    private readonly navigationEntries: NavigationTiming[],
    private readonly timeOrigin: number = 1_771_800_000_000,
  ) {}

  readTimeOrigin(): number {
    return this.timeOrigin;
  }

  readResources(): readonly ResourceTiming[] {
    return this.resourceEntries;
  }

  readNavigations(): readonly NavigationTiming[] {
    return this.navigationEntries;
  }
}

/** Stands in for `chrome.runtime` messaging, keeping the async boundary honest. */
class IntakeSink implements ObservationSink {
  private readonly pending: Promise<void>[] = [];

  constructor(
    private readonly intake: MetricsIntake,
    private readonly tabId: number,
    private readonly url: string,
  ) {}

  send(payload: PagePerformancePayload, timeOrigin: number): void {
    this.pending.push(
      this.intake.record({ tabId: this.tabId, url: this.url, payload, timeOrigin }),
    );
  }

  delivered(): Promise<void[]> {
    return Promise.all(this.pending);
  }
}

// ─── fixtures ────────────────────────────────────────────────────────────────

const resource = (transferSize: number): ResourceTiming => ({
  transferSize,
  decodedBodySize: transferSize,
});

/** Served from cache: nothing crossed the network, the bytes still reached the page. */
const cached = (decodedBodySize: number): ResourceTiming => ({
  transferSize: 0,
  decodedBodySize,
});

type Page = {
  tabId: number;
  url: string;
  entries: ResourceTiming[];
  navigationDurationMs: number;
};

/** Light blog article: 15 resources, 598 000 bytes, 800 ms load. */
const BLOG_PAGE: Page = {
  tabId: 10,
  url: "https://blog.example.com/article/42",
  entries: [
    resource(30_000), // main CSS
    resource(120_000), // main JS bundle
    resource(40_000), // hero image
    resource(38_000),
    resource(42_000),
    resource(35_000),
    resource(41_000),
    resource(39_000),
    resource(44_000),
    resource(37_000), // inline images
    resource(50_000),
    resource(50_000), // fonts
    resource(20_000), // analytics script
    resource(8_000), // favicon
    resource(4_000), // robots / misc
  ],
  navigationDurationMs: 800,
};

/** Heavy e-commerce page: 68 resources, ~12 MB, 4 500 ms load. */
const ECOMMERCE_PAGE: Page = {
  tabId: 20,
  url: "https://shop.example.com/products",
  entries: [
    resource(500_000),
    resource(300_000),
    resource(200_000),
    resource(150_000),
    resource(120_000), // JS bundles
    ...Array.from({ length: 30 }, () => resource(150_000)), // product images
    ...Array.from({ length: 20 }, () => resource(30_000)), // thumbnails
    resource(60_000), // CSS
    ...Array.from({ length: 4 }, () => resource(80_000)), // fonts
    ...Array.from({ length: 8 }, () => resource(5_000)), // tracking, APIs, config
  ],
  navigationDurationMs: 4_500,
};

/** Mostly cached: only two small JSON responses actually cross the network. */
const CACHED_NAVIGATION: Page = {
  tabId: 30,
  url: "https://app.example.com/dashboard",
  entries: [
    cached(400_000), // main bundle
    cached(300_000), // vendor bundle
    cached(50_000), // CSS
    resource(3_200), // /api/dashboard
    resource(1_800), // /api/user
  ],
  navigationDurationMs: 180,
};

// ─── harness ─────────────────────────────────────────────────────────────────

let store: MetricsStore;
let intake: MetricsIntake;

beforeEach(() => {
  const clock = new FixedClock(TODAY);
  store = createMetricsStore(ChromeStorage, clock);
  intake = new MetricsIntake(store, new CarbonCalculator());
});

/** Loads a page the way the extension does, and waits for it to be persisted. */
async function visit(page: Page, timeOrigin = 1_771_800_000_000): Promise<void> {
  const sink = new IntakeSink(intake, page.tabId, page.url);
  const source = new ScriptedPerformanceSource(
    page.entries,
    [{ duration: page.navigationDurationMs }],
    timeOrigin,
  );
  new MetricsCollector(source, sink).collect();
  await sink.delivered();
}

const visited = (record: DailyRecord, tabId: number) =>
  record.visits.find((visit) => visit.tabId === tabId)!;

// ─── tests ───────────────────────────────────────────────────────────────────

describe("A light page load", () => {
  it("records one request per resource the page fetched", async () => {
    // Act
    await visit(BLOG_PAGE);

    // Assert
    const record = await store.getDailyRecord();
    expect(visited(record, BLOG_PAGE.tabId).metrics.requestCount).toBe(15);
  });

  it("records transferred data in base-10 megabytes", async () => {
    // Act
    await visit(BLOG_PAGE);

    // Assert — 598 000 bytes / 10⁶
    const record = await store.getDailyRecord();
    expect(visited(record, BLOG_PAGE.tabId).metrics.totalResourceSize).toBeCloseTo(0.598, 3);
  });

  it("records the load duration in seconds", async () => {
    // Act
    await visit(BLOG_PAGE);

    // Assert
    const record = await store.getDailyRecord();
    expect(visited(record, BLOG_PAGE.tabId).metrics.pageLoadDurationSec).toBeCloseTo(0.8, 10);
  });

  it("attributes the visit to the page's own domain", async () => {
    // Act
    await visit(BLOG_PAGE);

    // Assert
    const record = await store.getDailyRecord();
    expect(visited(record, BLOG_PAGE.tabId).domain).toBe("blog.example.com");
  });
});

describe("A heavy page load", () => {
  it("counts every resource, repetitive ones included", async () => {
    // Act
    await visit(ECOMMERCE_PAGE);

    // Assert — 5 bundles + 30 images + 20 thumbnails + 5 CSS/fonts + 8 misc
    const record = await store.getDailyRecord();
    expect(visited(record, ECOMMERCE_PAGE.tabId).metrics.requestCount).toBe(68);
  });

  it("costs more carbon than a light page", async () => {
    // Act
    await visit(BLOG_PAGE);
    await visit(ECOMMERCE_PAGE);

    // Assert
    const record = await store.getDailyRecord();
    expect(visited(record, ECOMMERCE_PAGE.tabId).carbon.totalCo2).toBeGreaterThan(
      visited(record, BLOG_PAGE.tabId).carbon.totalCo2,
    );
  });
});

describe("A mostly cached page load", () => {
  it("counts cached resources as requests carrying no bytes", async () => {
    // Act
    await visit(CACHED_NAVIGATION);

    // Assert — 5 requests, only 5 000 bytes over the network
    const record = await store.getDailyRecord();
    const cached = visited(record, CACHED_NAVIGATION.tabId);
    expect(cached.metrics.requestCount).toBe(5);
    expect(cached.metrics.totalResourceSize).toBeCloseTo(0.005, 4);
  });

  it("emits less network carbon than a full page load", async () => {
    // Act
    await visit(CACHED_NAVIGATION);
    await visit(BLOG_PAGE);

    // Assert
    const record = await store.getDailyRecord();
    expect(visited(record, CACHED_NAVIGATION.tabId).carbon.networkCo2).toBeLessThan(
      visited(record, BLOG_PAGE.tabId).carbon.networkCo2,
    );
  });

  it("credits what the cache spared, in megabytes of page weight", async () => {
    // Act
    await visit(CACHED_NAVIGATION);

    // Assert — 400 000 + 300 000 + 50 000 bytes never crossed the network
    const record = await store.getDailyRecord();
    expect(visited(record, CACHED_NAVIGATION.tabId).metrics.cachedPageWeight).toBeCloseTo(0.75, 10);
  });

  it("reports the saving without deducting it from the footprint", async () => {
    // Act
    await visit(CACHED_NAVIGATION);

    // Assert — the total stays the sum of what was actually emitted
    const visit_ = visited(await store.getDailyRecord(), CACHED_NAVIGATION.tabId);
    expect(visit_.carbon.avoidedCo2).toBeGreaterThan(0);
    expect(visit_.carbon.totalCo2).toBeCloseTo(
      visit_.carbon.networkCo2 + visit_.carbon.deviceCo2 + visit_.carbon.screenCo2,
      10,
    );
  });

  it("carries the saving into the day's totals", async () => {
    // Act
    await visit(CACHED_NAVIGATION);
    await visit(BLOG_PAGE);

    // Assert
    const record = await store.getDailyRecord();
    const perPage = record.visits.reduce((sum, tab) => sum + tab.carbon.avoidedCo2, 0);
    expect(record.totalCarbon.avoidedCo2).toBeCloseTo(perPage, 10);
    expect(record.totalCarbon.avoidedCo2).toBeGreaterThan(0);
  });
});

describe("A day of browsing", () => {
  it("sums requests across every page visited", async () => {
    // Act
    await visit(BLOG_PAGE);
    await visit(ECOMMERCE_PAGE);
    await visit(CACHED_NAVIGATION);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.totalMetrics.requestCount).toBe(15 + 68 + 5);
  });

  it("keeps the day's carbon equal to the sum of its pages", async () => {
    // Act
    await visit(BLOG_PAGE);
    await visit(ECOMMERCE_PAGE);

    // Assert
    const record = await store.getDailyRecord();
    const perPage = record.visits.reduce((sum, tab) => sum + tab.carbon.totalCo2, 0);
    expect(record.totalCarbon.totalCo2).toBeCloseTo(perPage, 10);
  });

  it("files everything under the local day it happened on", async () => {
    // Act
    await visit(BLOG_PAGE);

    // Assert
    const days = await store.getAllDays();
    expect(days.map((day) => day.date)).toEqual([TODAY]);
  });

  it("reloading a tab replaces its measurements instead of adding an entry", async () => {
    // Arrange
    await visit(BLOG_PAGE);

    // Act — the user reloads and twice as many images come down the wire
    await visit({
      ...BLOG_PAGE,
      entries: [...BLOG_PAGE.entries, ...BLOG_PAGE.entries],
      navigationDurationMs: 400,
    });

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
    expect(record.totalMetrics.requestCount).toBe(30);
  });

  it("survives a reload storm without double-counting the tab", async () => {
    // Arrange — three loads racing, none awaited before the next starts
    const storm = [1_000_000, 2_000_000, 3_000_000].map((transferSize) =>
      visit({ ...BLOG_PAGE, entries: [resource(transferSize)] }),
    );

    // Act
    await Promise.all(storm);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
    expect(record.totalMetrics.requestCount).toBe(1);
  });
});
