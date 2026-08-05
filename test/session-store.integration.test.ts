/**
 * The metrics store against a real storage that happens to live in memory.
 *
 * Every assertion goes through the interface production uses. The store used to
 * publish four readers no production code called, plus a global reset hook, so
 * that a test could look inside it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMetricsStore } from "../src/session/store";
import type { MetricTab, MetricsStore } from "../src/session/types";
import { emptyCarbonEstimate, emptyDailyRecord, emptyMetrics } from "../src/session/aggregator";
import { InMemoryDailyRecordsStorage } from "./fakes/InMemoryDailyRecordsStorage";
import { FixedClock } from "./fakes/FixedClock";

const TODAY = "2026-02-23";
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

const tab = (overrides: Partial<MetricTab> = {}): MetricTab => ({
  id: 1,
  url: "https://example.com/page",
  domain: "example.com",
  metrics: { requestCount: 10, totalResourceSize: 5, cpuTimeToLoad: 1.2 },
  meta: { date: 0 },
  carbon: { networkCo2: 0.8, cpuCo2: 0.01, renderingCo2: 0.004, totalCo2: 0.814 },
  ...overrides,
});

const TAB_A = tab({ id: 1 });
const TAB_B = tab({
  id: 2,
  url: "https://other.com",
  domain: "other.com",
  metrics: { requestCount: 4, totalResourceSize: 2, cpuTimeToLoad: 0.5 },
  carbon: { networkCo2: 0.3, cpuCo2: 0.005, renderingCo2: 0.002, totalCo2: 0.307 },
});

let storage: InMemoryDailyRecordsStorage;
let clock: FixedClock;
let store: MetricsStore;

beforeEach(() => {
  storage = new InMemoryDailyRecordsStorage();
  clock = new FixedClock(TODAY);
  store = createMetricsStore(storage, clock);
});

describe("reading a day that has no data", () => {
  it("returns the neutral record rather than nothing", async () => {
    // Act
    const record = await store.getDailyRecord();

    // Assert
    expect(record).toEqual(emptyDailyRecord(TODAY));
  });

  it("reports zeroed totals", async () => {
    // Act
    const record = await store.getDailyRecord();

    // Assert
    expect(record.totalMetrics).toEqual(emptyMetrics());
    expect(record.totalCarbon).toEqual(emptyCarbonEstimate());
  });

  it("does not create the day just by being read", async () => {
    // Act
    await store.getDailyRecord();

    // Assert — a query must not write
    expect(storage.dates()).toEqual([]);
  });
});

describe("recording tab metrics", () => {
  it("stores a tab under today and reads it back", async () => {
    // Act
    await store.recordTabMetrics(TAB_A);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs).toHaveLength(1);
    expect(record.tabs[0].domain).toBe("example.com");
    expect(storage.dates()).toEqual([TODAY]);
  });

  it("keeps distinct tabs side by side", async () => {
    // Act
    await store.recordTabMetrics(TAB_A);
    await store.recordTabMetrics(TAB_B);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs.map((each) => each.id).sort()).toEqual([1, 2]);
  });

  it("rebuilds the day's totals from its tabs on every write", async () => {
    // Act
    await store.recordTabMetrics(TAB_A);
    await store.recordTabMetrics(TAB_B);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.totalMetrics.requestCount).toBe(14);
    expect(record.totalMetrics.totalResourceSize).toBe(7);
    expect(record.totalCarbon.totalCo2).toBeCloseTo(0.814 + 0.307, 10);
  });

  it("replaces the measurements of a tab already recorded today", async () => {
    // Arrange
    await store.recordTabMetrics(TAB_A);

    // Act
    await store.recordTabMetrics(
      tab({ id: 1, metrics: { requestCount: 20, totalResourceSize: 50, cpuTimeToLoad: 3 } }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs).toHaveLength(1);
    expect(record.tabs[0].metrics.requestCount).toBe(20);
    expect(record.totalMetrics.requestCount).toBe(20);
  });

  it("leaves the other tabs untouched when one is updated", async () => {
    // Arrange
    await store.recordTabMetrics(TAB_A);
    await store.recordTabMetrics(TAB_B);

    // Act
    await store.recordTabMetrics(
      tab({ id: 1, metrics: { requestCount: 99, totalResourceSize: 99, cpuTimeToLoad: 99 } }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs.find((each) => each.id === 2)!.metrics).toEqual(TAB_B.metrics);
  });

  it("keeps the identity of the first load when a tab is re-recorded", async () => {
    // Arrange
    await store.recordTabMetrics(TAB_A);

    // Act — the tab navigated elsewhere; today the unit of measure is the tab
    await store.recordTabMetrics(
      tab({ id: 1, url: "https://example.com/other", domain: "elsewhere.com" }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs[0].domain).toBe("example.com");
  });
});

describe("concurrent writes", () => {
  it("serializes distinct tabs without losing any", async () => {
    // Arrange
    const tabs = [TAB_A, TAB_B, tab({ id: 3, url: "https://third.com", domain: "third.com" })];

    // Act
    await Promise.all(tabs.map((each) => store.recordTabMetrics(each)));

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs.map((each) => each.id).sort()).toEqual([1, 2, 3]);
  });

  it("collapses concurrent writes of one tab into a single entry", async () => {
    // Arrange — the read-then-write race: deciding add-or-update outside the
    // queue let both calls conclude "not there yet" and append twice.
    const writes = [10, 20, 30].map((requestCount) =>
      store.recordTabMetrics(
        tab({ id: 1, metrics: { requestCount, totalResourceSize: 1, cpuTimeToLoad: 1 } }),
      ),
    );

    // Act
    await Promise.all(writes);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs).toHaveLength(1);
    expect(record.totalMetrics.requestCount).toBe(record.tabs[0].metrics.requestCount);
  });
});

describe("retention", () => {
  it("drops a day older than the window and keeps today", async () => {
    // Arrange
    storage.seedDay("2026-02-01", emptyDailyRecord("2026-02-01"));
    await store.recordTabMetrics(TAB_A);

    // Act
    await store.clearPastDays(1);

    // Assert
    expect(storage.dates()).toEqual([TODAY]);
  });

  it("keeps a day still inside the window", async () => {
    // Arrange
    storage.seedDay("2026-02-20", emptyDailyRecord("2026-02-20"));
    await store.recordTabMetrics(TAB_A);

    // Act
    await store.clearPastDays(7);

    // Assert
    expect(storage.dates()).toEqual(["2026-02-20", TODAY]);
  });

  it("keeps every day when retention is unlimited", async () => {
    // Arrange
    storage.seedDay("2020-01-01", emptyDailyRecord("2020-01-01"));
    await store.recordTabMetrics(TAB_A);

    // Act
    await store.clearPastDays(-1);

    // Assert
    expect(storage.dates()).toEqual(["2020-01-01", TODAY]);
  });

  it("never drops today, however short the window", async () => {
    // Arrange
    await store.recordTabMetrics(TAB_A);

    // Act
    await store.clearPastDays(0);

    // Assert
    expect(storage.dates()).toEqual([TODAY]);
  });

  it("still serves today after retention has run", async () => {
    // Arrange
    storage.seedDay("2026-02-01", emptyDailyRecord("2026-02-01"));
    await store.recordTabMetrics(TAB_A);
    await store.getDailyRecord();

    // Act
    await store.clearPastDays(1);

    // Assert — the cache was dropped, so this re-reads storage
    const record = await store.getDailyRecord();
    expect(record.tabs).toHaveLength(1);
  });
});

describe("reading across days", () => {
  it("returns every stored day in chronological order", async () => {
    // Arrange
    storage.seedDay("2026-02-24", emptyDailyRecord("2026-02-24"));
    storage.seedDay("2026-02-22", emptyDailyRecord("2026-02-22"));
    await store.recordTabMetrics(TAB_A);

    // Act
    const days = await store.getAllDays();

    // Assert
    expect(days.map((day) => day.date)).toEqual(["2026-02-22", TODAY, "2026-02-24"]);
  });

  it("returns nothing when no day was ever recorded", async () => {
    // Act & Assert
    expect(await store.getAllDays()).toEqual([]);
  });
});

describe("crossing midnight", () => {
  it("serves the new day empty once the clock rolls over", async () => {
    // Arrange
    await store.recordTabMetrics(TAB_A);

    // Act
    clock.advance(MS_PER_DAY);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.date).toBe("2026-02-24");
    expect(record.tabs).toEqual([]);
  });

  it("leaves yesterday's data intact", async () => {
    // Arrange
    await store.recordTabMetrics(TAB_A);

    // Act
    clock.advance(MS_PER_DAY);
    await store.recordTabMetrics(TAB_B);

    // Assert
    const days = await store.getAllDays();
    expect(days.map((day) => day.tabs.length)).toEqual([1, 1]);
  });
});
