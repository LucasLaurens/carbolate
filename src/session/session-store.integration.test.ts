/**
 * The metrics store against a real storage that happens to live in memory.
 *
 * Every assertion goes through the interface production uses. The store used to
 * publish four readers no production code called, plus a global reset hook, so
 * that a test could look inside it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMetricsStore } from "./store";
import type { PageVisit, MetricsStore } from "./types";
import {
  createEmptyCarbonEstimate,
  createEmptyDailyRecord,
  createEmptyMetrics,
} from "./aggregator";
import { InMemoryDailyRecordsStorage } from "../../test/fakes/InMemoryDailyRecordsStorage";
import { FixedClock } from "../../test/fakes/FixedClock";

const TODAY = "2026-02-23";
const MS_PER_DAY = 24 * 60 * 60 * 1_000;
/**
 * A document start on TODAY — the identity timestamp, not the hour the message
 * landed. It also decides which day a visit is filed under, so it must agree
 * with the clock.
 */
const LOADED_AT = new Date(`${TODAY}T11:00:00`).getTime();
/** The one content script observing that document — see the observation-instance ADR. */
const OBSERVED_FROM = LOADED_AT + 500;

const visit = (overrides: Partial<PageVisit> = {}): PageVisit => ({
  tabId: 1,
  url: "https://example.com/page",
  domain: "example.com",
  metrics: {
    requestCount: 10,
    thirdPartyRequests: 3,
    totalResourceSize: 5,
    pageLoadDurationSec: 1.2,
    visibleDurationSec: 30,
    cachedPageWeight: 0.4,
  },
  meta: { date: LOADED_AT, observedFrom: OBSERVED_FROM },
  carbon: {
    networkCo2: 0.8,
    deviceCo2: 0.0098,
    screenCo2: 0.0042,
    totalCo2: 0.814,
    avoidedCo2: 0.07,
  },
  ...overrides,
});

const VISIT_A = visit({ tabId: 1 });
const VISIT_B = visit({
  tabId: 2,
  url: "https://other.com",
  domain: "other.com",
  metrics: {
    requestCount: 4,
    thirdPartyRequests: 3,
    totalResourceSize: 2,
    pageLoadDurationSec: 0.5,
    visibleDurationSec: 30,
    cachedPageWeight: 0.1,
  },
  carbon: {
    networkCo2: 0.3,
    deviceCo2: 0.0049,
    screenCo2: 0.0021,
    totalCo2: 0.307,
    avoidedCo2: 0.02,
  },
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
    expect(record).toEqual(createEmptyDailyRecord(TODAY));
  });

  it("reports zeroed totals", async () => {
    // Act
    const record = await store.getDailyRecord();

    // Assert
    expect(record.totalMetrics).toEqual(createEmptyMetrics());
    expect(record.totalCarbon).toEqual(createEmptyCarbonEstimate());
  });

  it("does not create the day just by being read", async () => {
    // Act
    await store.getDailyRecord();

    // Assert — a query must not write
    expect(storage.dates()).toEqual([]);
  });
});

describe("recording a page visit", () => {
  it("stores a visit under today and reads it back", async () => {
    // Act
    await store.recordPageVisit(VISIT_A);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
    expect(record.visits[0].domain).toBe("example.com");
    expect(storage.dates()).toEqual([TODAY]);
  });

  it("keeps distinct visits side by side", async () => {
    // Act
    await store.recordPageVisit(VISIT_A);
    await store.recordPageVisit(VISIT_B);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits.map((each) => each.tabId).sort()).toEqual([1, 2]);
  });

  it("rebuilds the day's totals from its visits on every write", async () => {
    // Act
    await store.recordPageVisit(VISIT_A);
    await store.recordPageVisit(VISIT_B);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.totalMetrics.requestCount).toBe(14);
    expect(record.totalMetrics.totalResourceSize).toBe(7);
    expect(record.totalCarbon.totalCo2).toBeCloseTo(0.814 + 0.307, 10);
  });

  it("replaces the measurements of a visit already recorded today", async () => {
    // Arrange
    await store.recordPageVisit(VISIT_A);

    // Act
    await store.recordPageVisit(
      visit({
        tabId: 1,
        metrics: {
          requestCount: 20,
          thirdPartyRequests: 3,
          totalResourceSize: 50,
          pageLoadDurationSec: 3,
          visibleDurationSec: 30,
          cachedPageWeight: 0,
        },
      }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
    expect(record.visits[0].metrics.requestCount).toBe(20);
    expect(record.totalMetrics.requestCount).toBe(20);
  });

  it("leaves the other visits untouched when one is updated", async () => {
    // Arrange
    await store.recordPageVisit(VISIT_A);
    await store.recordPageVisit(VISIT_B);

    // Act
    await store.recordPageVisit(
      visit({
        tabId: 1,
        metrics: {
          requestCount: 99,
          thirdPartyRequests: 3,
          totalResourceSize: 99,
          pageLoadDurationSec: 99,
          visibleDurationSec: 30,
          cachedPageWeight: 99,
        },
      }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits.find((each) => each.tabId === 2)!.metrics).toEqual(VISIT_B.metrics);
  });

  it("counts a reload of the same URL as a second visit", async () => {
    // Arrange
    await store.recordPageVisit(VISIT_A);

    // Act — same tab, same URL, a new document: two F5 are two documents
    await store.recordPageVisit(
      visit({ tabId: 1, meta: { date: LOADED_AT + 60_000, observedFrom: OBSERVED_FROM } }),
    );

    // Assert — replacing would under-count bytes that really crossed the network
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(2);
    expect(record.totalMetrics.requestCount).toBe(20);
  });

  it("counts the same URL open in two tabs as two visits", async () => {
    // Arrange
    await store.recordPageVisit(VISIT_A);

    // Act — same document start, same URL, another tab
    await store.recordPageVisit(visit({ tabId: 2 }));

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(2);
  });

  it("counts a navigation inside one document as its own visit", async () => {
    // Arrange
    await store.recordPageVisit(VISIT_A);

    // Act — same tab, same document start, another URL: an SPA navigation
    await store.recordPageVisit(visit({ url: "https://example.com/other" }));

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(2);
  });

  it("keeps a second script observing one document apart from the first", async () => {
    // Arrange — the tab is open and measured; 1129 resources have crossed
    await store.recordPageVisit(
      visit({ tabId: 1, metrics: { ...VISIT_A.metrics, requestCount: 1129 } }),
    );

    // Act — the add-on is reloaded, a second script is injected into the same
    // document, and `buffered: true` replays only the 250 entries still held
    await store.recordPageVisit(
      visit({
        tabId: 1,
        meta: { date: LOADED_AT, observedFrom: OBSERVED_FROM + 3_600_000 },
        metrics: { ...VISIT_A.metrics, requestCount: 250 },
      }),
    );

    // Assert — on a three-part key the 250 replaced the 1129: a cumulative
    // counter running backwards. See the observation-instance ADR.
    const record = await store.getDailyRecord();
    expect(record.visits.map((visit) => visit.metrics.requestCount)).toEqual([1129, 250]);
  });

  it("routes a delta onto the visit it belongs to, without adding one", async () => {
    // Arrange
    await store.recordPageVisit(VISIT_A);
    await store.recordPageVisit(
      visit({ tabId: 1, meta: { date: LOADED_AT + 60_000, observedFrom: OBSERVED_FROM } }),
    );

    // Act — a later measurement of the first load, same three-part key
    await store.recordPageVisit(
      visit({
        tabId: 1,
        metrics: {
          requestCount: 42,
          thirdPartyRequests: 3,
          totalResourceSize: 5,
          pageLoadDurationSec: 1.2,
          visibleDurationSec: 30,
          cachedPageWeight: 0.4,
        },
      }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(2);
    expect(record.visits[0].metrics.requestCount).toBe(42);
    expect(record.visits[1].metrics.requestCount).toBe(10);
  });
});

describe("a visit that crosses midnight", () => {
  it("files a delta on the day the visit began, not on the day it lands", async () => {
    // Arrange — a page loaded yesterday, still open
    await store.recordPageVisit(VISIT_A);
    clock.advance(MS_PER_DAY);

    // Act — the same visit reports its totals again, after midnight
    await store.recordPageVisit(
      visit({
        metrics: {
          requestCount: 40,
          thirdPartyRequests: 3,
          totalResourceSize: 5,
          pageLoadDurationSec: 1.2,
          visibleDurationSec: 900,
          cachedPageWeight: 0.4,
        },
      }),
    );

    // Assert — those bytes belong to yesterday; the new day must not inherit them
    const [yesterday, today] = await store.getAllDays();
    expect(yesterday.date).toBe(TODAY);
    expect(yesterday.visits).toHaveLength(1);
    expect(yesterday.totalMetrics.requestCount).toBe(40);
    expect(today).toBeUndefined();
  });

  it("ignores a delta for a day retention has already dropped", async () => {
    // Arrange — yesterday is stored, then purged at the day boundary
    await store.recordPageVisit(VISIT_A);
    clock.advance(MS_PER_DAY);
    await store.clearPastDays(1);

    // Act — the tab from yesterday is still open and reports again
    await store.recordPageVisit(visit({ meta: { date: LOADED_AT, observedFrom: OBSERVED_FROM } }));

    // Assert — a purged day stays purged; the warning the panel showed stays true
    expect(storage.dates()).toEqual([]);
  });
});

describe("concurrent writes", () => {
  it("serializes distinct visits without losing any", async () => {
    // Arrange
    const visits = [
      VISIT_A,
      VISIT_B,
      visit({ tabId: 3, url: "https://third.com", domain: "third.com" }),
    ];

    // Act
    await Promise.all(visits.map((each) => store.recordPageVisit(each)));

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits.map((each) => each.tabId).sort()).toEqual([1, 2, 3]);
  });

  it("collapses concurrent writes of one visit into a single entry", async () => {
    // Arrange — the read-then-write race: deciding add-or-update outside the
    // queue let both calls conclude "not there yet" and append twice.
    const writes = [10, 20, 30].map((requestCount) =>
      store.recordPageVisit(
        visit({
          tabId: 1,
          metrics: {
            requestCount,
            thirdPartyRequests: 0,
            totalResourceSize: 1,
            pageLoadDurationSec: 1,
            visibleDurationSec: 30,
            cachedPageWeight: 0,
          },
        }),
      ),
    );

    // Act
    await Promise.all(writes);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
    expect(record.totalMetrics.requestCount).toBe(record.visits[0].metrics.requestCount);
  });
});

describe("retention", () => {
  it("drops a day older than the window and keeps today", async () => {
    // Arrange
    storage.seedDay("2026-02-01", createEmptyDailyRecord("2026-02-01"));
    await store.recordPageVisit(VISIT_A);

    // Act
    await store.clearPastDays(1);

    // Assert
    expect(storage.dates()).toEqual([TODAY]);
  });

  it("keeps a day still inside the window", async () => {
    // Arrange
    storage.seedDay("2026-02-20", createEmptyDailyRecord("2026-02-20"));
    await store.recordPageVisit(VISIT_A);

    // Act
    await store.clearPastDays(7);

    // Assert
    expect(storage.dates()).toEqual(["2026-02-20", TODAY]);
  });

  it("keeps every day when retention is unlimited", async () => {
    // Arrange
    storage.seedDay("2020-01-01", createEmptyDailyRecord("2020-01-01"));
    await store.recordPageVisit(VISIT_A);

    // Act
    await store.clearPastDays(-1);

    // Assert
    expect(storage.dates()).toEqual(["2020-01-01", TODAY]);
  });

  it("never drops today, however short the window", async () => {
    // Arrange
    await store.recordPageVisit(VISIT_A);

    // Act
    await store.clearPastDays(0);

    // Assert
    expect(storage.dates()).toEqual([TODAY]);
  });

  it("still serves today after retention has run", async () => {
    // Arrange
    storage.seedDay("2026-02-01", createEmptyDailyRecord("2026-02-01"));
    await store.recordPageVisit(VISIT_A);
    await store.getDailyRecord();

    // Act
    await store.clearPastDays(1);

    // Assert — nothing is held in memory, so this reads what storage now holds
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
  });
});

describe("two contexts sharing the storage", () => {
  it("serves what another writer stored, without being told to forget anything", async () => {
    // Arrange — the panel's own store, next to the background's
    const panel = createMetricsStore(storage, clock);
    await panel.getDailyRecord();

    // Act — the background records a visit through its own instance
    await store.recordPageVisit(VISIT_A);

    // Assert — a living record writes every few seconds; a cached day would go stale
    const record = await panel.getDailyRecord();
    expect(record.visits).toHaveLength(1);
  });
});

describe("reading across days", () => {
  it("returns every stored day in chronological order", async () => {
    // Arrange
    storage.seedDay("2026-02-24", createEmptyDailyRecord("2026-02-24"));
    storage.seedDay("2026-02-22", createEmptyDailyRecord("2026-02-22"));
    await store.recordPageVisit(VISIT_A);

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
    await store.recordPageVisit(VISIT_A);

    // Act
    clock.advance(MS_PER_DAY);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.date).toBe("2026-02-24");
    expect(record.visits).toEqual([]);
  });

  it("leaves yesterday's data intact", async () => {
    // Arrange
    await store.recordPageVisit(VISIT_A);

    // Act — a page opened after the rollover carries a document start of its own
    clock.advance(MS_PER_DAY);
    await store.recordPageVisit(
      visit({ tabId: 2, meta: { date: clock.nowMs(), observedFrom: OBSERVED_FROM } }),
    );

    // Assert
    const days = await store.getAllDays();
    expect(days.map((day) => day.visits.length)).toEqual([1, 1]);
  });
});
