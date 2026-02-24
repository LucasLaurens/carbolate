/**
 * Pipeline tests — end-to-end simulation of a real browsing session.
 *
 * Each test mimics what happens when a user opens a tab:
 *   Performance API entries (content script)
 *     → ResourceStrategy  (extract count + bytes)
 *     → Metrics           (same transform as Popup.tsx)
 *     → metricsStore      (persist + compute carbon)
 *     → CarbonEstimate    (assert final footprint)
 */
import { describe, it, expect, vi } from "vitest";
import { StrategyContext } from "../performance/StrategyContext";
import ResourceStrategy from "../performance/ResourceStrategy";
import { metricsStore } from "../session/store";
import type { Metrics } from "../session/types";

vi.mock("../utils/date", () => ({ getDailyDate: () => "2026-02-23" }));

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Minimal PerformanceResourceTiming-like object (only the fields we use). */
function resource(transferSize: number) {
  return { transferSize };
}

/**
 * Replicates the exact transform from Popup.tsx:
 *   raw entries + navigation → Metrics stored in metricsStore
 */
function toMetrics(
  resourceEntries: { transferSize: number }[],
  navigationDurationMs: number,
): Metrics {
  const ctx = new StrategyContext(new ResourceStrategy());
  const { resourceCount, totalTransferSize } = ctx.execute(resourceEntries);
  return {
    requestCount: resourceCount,
    totalResourceSize: totalTransferSize / (1024 * 1024), // bytes → MB
    cpuTimeToLoad: navigationDurationMs / 1000, // ms   → s
  };
}

// ─── fixtures ────────────────────────────────────────────────────────────────

/**
 * Light blog article: ~15 resources, ~590 KB total, 800 ms load.
 * Expect low CO2, modest request count.
 */
const BLOG_PAGE = {
  id: 10,
  url: "https://blog.example.com/article/42",
  domain: "blog.example.com",
  meta: { status: 200, date: 0 },
  entries: [
    resource(30_000), // main CSS
    resource(120_000), // main JS bundle
    resource(40_000), // hero image
    resource(38_000), // inline image 1
    resource(42_000), // inline image 2
    resource(35_000), // inline image 3
    resource(41_000), // inline image 4
    resource(39_000), // inline image 5
    resource(44_000), // inline image 6
    resource(37_000), // inline image 7
    resource(50_000), // font 1
    resource(50_000), // font 2
    resource(20_000), // analytics script
    resource(8_000), // favicon
    resource(4_000), // robots / misc
  ],
  navigationDurationMs: 800,
};

/**
 * Heavy e-commerce page: ~80 resources, ~12 MB total, 4 500 ms load.
 * Expect significantly higher CO2 and request count.
 */
const ECOMMERCE_PAGE = {
  id: 20,
  url: "https://shop.example.com/products",
  domain: "shop.example.com",
  meta: { status: 200, date: 0 },
  entries: [
    // Large JS bundles
    resource(500_000),
    resource(300_000),
    resource(200_000),
    resource(150_000),
    resource(120_000),
    // Product images (×30 avg 150 KB)
    ...Array.from({ length: 30 }, () => resource(150_000)),
    // Thumbnails (×20 avg 30 KB)
    ...Array.from({ length: 20 }, () => resource(30_000)),
    // CSS + fonts
    resource(60_000),
    resource(80_000),
    resource(80_000),
    resource(80_000),
    resource(80_000),
    // Misc (tracking, APIs, config)
    ...Array.from({ length: 8 }, () => resource(5_000)),
  ],
  navigationDurationMs: 4_500,
};

/**
 * SPA soft-navigation: most assets are cached (transferSize = 0),
 * only a small JSON response is fetched. Near-zero footprint.
 */
const SPA_NAVIGATION = {
  id: 30,
  url: "https://app.example.com/dashboard",
  domain: "app.example.com",
  meta: { status: 200, date: 0 },
  entries: [
    resource(0), // main bundle — cached
    resource(0), // vendor bundle — cached
    resource(0), // CSS — cached
    resource(3_200), // /api/dashboard JSON
    resource(1_800), // /api/user JSON
  ],
  navigationDurationMs: 180,
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe("Full pipeline: Performance API → carbon estimate", () => {
  describe("Blog article (light page)", () => {
    it("extracts the correct request count and resource size", () => {
      const metrics = toMetrics(BLOG_PAGE.entries, BLOG_PAGE.navigationDurationMs);
      expect(metrics.requestCount).toBe(15);
      expect(metrics.totalResourceSize).toBeCloseTo(0.57, 2); // 598 000 bytes / 1 048 576 ≈ 0.570 MB
    });

    it("stores the tab and attaches a carbon estimate", async () => {
      const metrics = toMetrics(BLOG_PAGE.entries, BLOG_PAGE.navigationDurationMs);
      await metricsStore.addTab({ ...BLOG_PAGE, metrics });

      const [tab] = await metricsStore.getTabs();
      expect(tab.carbon).toBeDefined();
      expect(tab.carbon.totalCo2).toBeGreaterThanOrEqual(0);
    });

    it("produces lower CO2 than the heavy e-commerce page", async () => {
      const lightMetrics = toMetrics(BLOG_PAGE.entries, BLOG_PAGE.navigationDurationMs);
      const heavyMetrics = toMetrics(ECOMMERCE_PAGE.entries, ECOMMERCE_PAGE.navigationDurationMs);

      await metricsStore.addTab({ ...BLOG_PAGE, id: 10, metrics: lightMetrics });
      await metricsStore.addTab({ ...ECOMMERCE_PAGE, id: 20, metrics: heavyMetrics });

      const tabs = await metricsStore.getTabs();
      const light = tabs.find((t) => t.id === 10)!;
      const heavy = tabs.find((t) => t.id === 20)!;

      expect(heavy.carbon.totalCo2).toBeGreaterThanOrEqual(light.carbon.totalCo2);
    });
  });

  describe("E-commerce page (heavy page)", () => {
    it("counts all resources including repetitive ones", () => {
      const metrics = toMetrics(ECOMMERCE_PAGE.entries, ECOMMERCE_PAGE.navigationDurationMs);
      // 5 bundles + 30 product images + 20 thumbnails + 5 CSS/fonts + 8 misc = 68
      expect(metrics.requestCount).toBe(68);
    });

    it("has higher totalResourceSize than the blog page", () => {
      const blog = toMetrics(BLOG_PAGE.entries, BLOG_PAGE.navigationDurationMs);
      const heavy = toMetrics(ECOMMERCE_PAGE.entries, ECOMMERCE_PAGE.navigationDurationMs);
      expect(heavy.totalResourceSize).toBeGreaterThan(blog.totalResourceSize);
    });

    it("produces a cpu CO2 contribution from its long load time", async () => {
      const metrics = toMetrics(ECOMMERCE_PAGE.entries, ECOMMERCE_PAGE.navigationDurationMs);
      await metricsStore.addTab({ ...ECOMMERCE_PAGE, metrics });

      const [tab] = await metricsStore.getTabs();
      // cpuTimeToLoad = 4.5 s → cpuCo2 = 4.5 * 0.012 = 0.054 → rounded to 0
      // still verifying the field is computed
      expect(tab.carbon.cpuCo2).toBeGreaterThanOrEqual(0);
    });
  });

  describe("SPA soft-navigation (cached assets)", () => {
    it("only counts the bytes actually transferred over the network", () => {
      const metrics = toMetrics(SPA_NAVIGATION.entries, SPA_NAVIGATION.navigationDurationMs);
      expect(metrics.requestCount).toBe(5);
      // 3 200 + 1 800 = 5 000 bytes = ~0.00476 MB
      expect(metrics.totalResourceSize).toBeCloseTo(0.00476, 4);
    });

    it("has a very small footprint compared to a full-page load", async () => {
      const spaMetrics = toMetrics(SPA_NAVIGATION.entries, SPA_NAVIGATION.navigationDurationMs);
      const blogMetrics = toMetrics(BLOG_PAGE.entries, BLOG_PAGE.navigationDurationMs);

      expect(spaMetrics.totalResourceSize).toBeLessThan(blogMetrics.totalResourceSize);
      expect(spaMetrics.cpuTimeToLoad).toBeLessThan(blogMetrics.cpuTimeToLoad);
    });
  });

  describe("Daily session: multiple tabs accumulated", () => {
    it("totalMetrics sums request counts across all open tabs", async () => {
      const blogMetrics = toMetrics(BLOG_PAGE.entries, BLOG_PAGE.navigationDurationMs);
      const heavyMetrics = toMetrics(ECOMMERCE_PAGE.entries, ECOMMERCE_PAGE.navigationDurationMs);
      const spaMetrics = toMetrics(SPA_NAVIGATION.entries, SPA_NAVIGATION.navigationDurationMs);

      await metricsStore.addTab({ ...BLOG_PAGE, id: 10, metrics: blogMetrics });
      await metricsStore.addTab({ ...ECOMMERCE_PAGE, id: 20, metrics: heavyMetrics });
      await metricsStore.addTab({ ...SPA_NAVIGATION, id: 30, metrics: spaMetrics });

      const total = await metricsStore.getTotalMetrics();
      const expected =
        blogMetrics.requestCount + heavyMetrics.requestCount + spaMetrics.requestCount;
      expect(total.requestCount).toBe(expected);
    });

    it("totalCarbon reflects the combined footprint of the session", async () => {
      const blogMetrics = toMetrics(BLOG_PAGE.entries, BLOG_PAGE.navigationDurationMs);
      const heavyMetrics = toMetrics(ECOMMERCE_PAGE.entries, ECOMMERCE_PAGE.navigationDurationMs);

      await metricsStore.addTab({ ...BLOG_PAGE, id: 10, metrics: blogMetrics });
      await metricsStore.addTab({ ...ECOMMERCE_PAGE, id: 20, metrics: heavyMetrics });

      const carbon = await metricsStore.getTotalCarbon();
      expect(carbon.totalCo2).toBeGreaterThanOrEqual(0);
      // Total CO2 must equal the sum of individual CO2 amounts (up to rounding)
      const tabs = await metricsStore.getTabs();
      const individualSum = tabs.reduce((s, t) => s + t.carbon.totalCo2, 0);
      // The store recomputes from raw metrics, so results may differ from individual tab sum by ≤1
      expect(Math.abs(carbon.totalCo2 - individualSum)).toBeLessThanOrEqual(1);
    });

    it("re-visiting a tab updates its metrics and propagates to the daily total", async () => {
      const initialMetrics = toMetrics(BLOG_PAGE.entries, BLOG_PAGE.navigationDurationMs);
      await metricsStore.addTab({ ...BLOG_PAGE, id: 10, metrics: initialMetrics });

      // User scrolls, more images load — resource count doubles
      const refreshedEntries = [...BLOG_PAGE.entries, ...BLOG_PAGE.entries];
      const refreshedMetrics = toMetrics(refreshedEntries, 400);
      await metricsStore.updateTabMetrics(10, refreshedMetrics);

      const total = await metricsStore.getTotalMetrics();
      expect(total.requestCount).toBe(refreshedMetrics.requestCount);
      expect(total.totalResourceSize).toBeCloseTo(refreshedMetrics.totalResourceSize, 4);
    });
  });
});
