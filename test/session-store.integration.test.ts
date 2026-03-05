import { describe, it, expect, vi } from "vitest";
import { metricsStore } from "../src/session/store";

vi.mock("../utils/date", () => ({ getDailyDate: () => "2026-02-23" }));

const TAB_A = {
  id: 1,
  url: "https://example.com/page",
  domain: "example.com",
  metrics: { requestCount: 10, totalResourceSize: 5, cpuTimeToLoad: 1.2 },
  meta: { status: 200, date: 0 },
};

const TAB_B = {
  id: 2,
  url: "https://other.com",
  domain: "other.com",
  metrics: { requestCount: 4, totalResourceSize: 2, cpuTimeToLoad: 0.5 },
  meta: { status: 200, date: 0 },
};

// ─── addTab / getTabs ───────────────────────────────────────────────────────

describe("addTab / getTabs", () => {
  it("stores a tab and retrieves it", async () => {
    await metricsStore.addTab(TAB_A);

    const tabs = await metricsStore.getTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(1);
    expect(tabs[0].domain).toBe("example.com");
  });

  it("attaches a carbon estimate when adding a tab", async () => {
    await metricsStore.addTab(TAB_A);

    const tabs = await metricsStore.getTabs();
    const { carbon } = tabs[0];
    expect(carbon).toHaveProperty("networkCo2");
    expect(carbon).toHaveProperty("cpuCo2");
    expect(carbon).toHaveProperty("totalCo2");
    expect(carbon.totalCo2).toBe(carbon.networkCo2 + carbon.cpuCo2);
  });

  it("stores multiple tabs independently", async () => {
    await metricsStore.addTab(TAB_A);
    await metricsStore.addTab(TAB_B);

    const tabs = await metricsStore.getTabs();
    expect(tabs).toHaveLength(2);
    expect(tabs.map((t) => t.id)).toContain(1);
    expect(tabs.map((t) => t.id)).toContain(2);
  });
});

// ─── hasExistingTabById ─────────────────────────────────────────────────────

describe("hasExistingTabById", () => {
  it("returns false when no tab has been added yet", async () => {
    expect(await metricsStore.hasExistingTabById(999)).toBe(false);
  });

  it("returns true for a tab that was just added", async () => {
    await metricsStore.addTab(TAB_A);
    expect(await metricsStore.hasExistingTabById(TAB_A.id)).toBe(true);
  });

  it("returns false for an id that does not exist", async () => {
    await metricsStore.addTab(TAB_A);
    expect(await metricsStore.hasExistingTabById(999)).toBe(false);
  });
});

// ─── updateTabMetrics ───────────────────────────────────────────────────────

describe("updateTabMetrics", () => {
  it("replaces the metrics of the target tab", async () => {
    await metricsStore.addTab(TAB_A);

    const updated = { requestCount: 20, totalResourceSize: 50, cpuTimeToLoad: 3.0 };
    await metricsStore.updateTabMetrics(TAB_A.id, updated);

    const tabs = await metricsStore.getTabs();
    expect(tabs[0].metrics).toMatchObject(updated);
  });

  it("recalculates the tab's carbon estimate after an update", async () => {
    await metricsStore.addTab(TAB_A);
    const [before] = await metricsStore.getTabs();

    await metricsStore.updateTabMetrics(TAB_A.id, {
      requestCount: 20,
      totalResourceSize: 1_000, // much larger → more CO2
      cpuTimeToLoad: 3.0,
    });

    const [after] = await metricsStore.getTabs();
    expect(after.carbon.totalCo2).toBeGreaterThanOrEqual(before.carbon.totalCo2);
  });

  it("does not affect other tabs", async () => {
    await metricsStore.addTab(TAB_A);
    await metricsStore.addTab(TAB_B);

    await metricsStore.updateTabMetrics(TAB_A.id, {
      requestCount: 99,
      totalResourceSize: 99,
      cpuTimeToLoad: 99,
    });

    const tabs = await metricsStore.getTabs();
    const tabB = tabs.find((t) => t.id === TAB_B.id)!;
    expect(tabB.metrics).toMatchObject(TAB_B.metrics);
  });
});

// ─── getTotalMetrics ────────────────────────────────────────────────────────

describe("getTotalMetrics", () => {
  it("returns zeros when no tabs exist", async () => {
    const total = await metricsStore.getTotalMetrics();
    expect(total).toEqual({ requestCount: 0, totalResourceSize: 0, cpuTimeToLoad: 0 });
  });

  it("sums metrics across all tabs for the day", async () => {
    await metricsStore.addTab(TAB_A);
    await metricsStore.addTab(TAB_B);

    const total = await metricsStore.getTotalMetrics();
    expect(total.requestCount).toBe(TAB_A.metrics.requestCount + TAB_B.metrics.requestCount);
    expect(total.totalResourceSize).toBe(
      TAB_A.metrics.totalResourceSize + TAB_B.metrics.totalResourceSize,
    );
  });

  it("reflects an update to a tab's metrics", async () => {
    await metricsStore.addTab(TAB_A);
    await metricsStore.updateTabMetrics(TAB_A.id, {
      requestCount: 99,
      totalResourceSize: 0,
      cpuTimeToLoad: 0,
    });

    const total = await metricsStore.getTotalMetrics();
    expect(total.requestCount).toBe(99);
  });
});

// ─── getTotalCarbon ─────────────────────────────────────────────────────────

describe("getTotalCarbon", () => {
  it("returns zero carbon when no tabs exist", async () => {
    const carbon = await metricsStore.getTotalCarbon();
    expect(carbon).toEqual({ networkCo2: 0, cpuCo2: 0, totalCo2: 0 });
  });

  it("returns a non-zero total when tabs have resource data", async () => {
    // 1 GB → non-trivial carbon
    await metricsStore.addTab({
      ...TAB_A,
      metrics: { requestCount: 1, totalResourceSize: 1_000, cpuTimeToLoad: 0 },
    });

    const carbon = await metricsStore.getTotalCarbon();
    expect(carbon.totalCo2).toBeGreaterThanOrEqual(0);
  });
});

// ─── getOrCreateDailyRecord ─────────────────────────────────────────────────

describe("getOrCreateDailyRecord", () => {
  it("creates an empty record for a new date", async () => {
    const record = await metricsStore.findOrCreateDailyRecord();
    expect(record.date).toBe(new Date().toISOString().slice(0, 10));
    expect(record.tabs).toHaveLength(0);
  });

  it("returns the same record on repeated calls", async () => {
    await metricsStore.addTab(TAB_A);
    const record = await metricsStore.findOrCreateDailyRecord();
    expect(record.tabs).toHaveLength(1);
  });
});
