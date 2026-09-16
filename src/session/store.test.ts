import { describe, it, expect, beforeEach } from "vitest";
import { createMetricsStore } from "./store";
import type { MetricsStore, PageVisit } from "./types";
import { createEmptyDailyRecord } from "./aggregator";
import { KEEP_EVERYTHING } from "../config/retention";
import { InMemoryDailyRecordsStorage } from "../../test/fakes/InMemoryDailyRecordsStorage";
import { QuotaLimitedDailyRecordsStorage } from "../../test/fakes/QuotaLimitedDailyRecordsStorage";
import { FixedClock } from "../../test/fakes/FixedClock";

const TODAY = "2026-08-21";
const A_WEEK = 7;
const KEEP_TODAY_ONLY = 1;

/** Eight consecutive days ending today — enough to catch a window one day too wide. */
const SEEDED_DAYS = [
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
  "2026-08-17",
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  TODAY,
];

let storage: InMemoryDailyRecordsStorage;
let store: MetricsStore;

beforeEach(() => {
  storage = new InMemoryDailyRecordsStorage();
  SEEDED_DAYS.forEach((date) => storage.seedDay(date, createEmptyDailyRecord(date)));
  store = createMetricsStore(storage, new FixedClock(TODAY));
});

describe("clearPastDays", () => {
  it("keeps exactly seven days for a rolling week", async () => {
    // Act
    await store.clearPastDays(A_WEEK);

    // Assert — the cutoff day itself used to survive, making the window eight days
    expect(storage.dates()).toEqual(SEEDED_DAYS.slice(1));
  });

  it("keeps exactly one day for a one-day window", async () => {
    // Act
    await store.clearPastDays(KEEP_TODAY_ONLY);

    // Assert
    expect(storage.dates()).toEqual([TODAY]);
  });

  it("drops nothing when everything is kept", async () => {
    // Act
    await store.clearPastDays(KEEP_EVERYTHING);

    // Assert
    expect(storage.dates()).toEqual(SEEDED_DAYS);
  });

  it("keeps the current day even when the window leaves no room for it", async () => {
    // Act
    await store.clearPastDays(0);

    // Assert
    expect(storage.dates()).toEqual([TODAY]);
  });
});

const visit = (overrides: Partial<PageVisit> = {}): PageVisit => ({
  tabId: 1,
  url: "https://example.com/page",
  domain: "example.com",
  metrics: {
    requestCount: 12,
    thirdPartyRequests: 3,
    totalResourceSize: 1.5,
    pageLoadDurationSec: 2.4,
    visibleDurationSec: 12,
    cachedPageWeight: 0.8,
  },
  meta: { date: new Date(`${TODAY}T10:00:00`).getTime(), observedFrom: 1 },
  carbon: {
    networkCo2: 0.26,
    deviceCo2: 0.002,
    screenCo2: 0.001,
    totalCo2: 0.263,
    avoidedCo2: 0.14,
  },
  ...overrides,
});

/** Room for one visit of the shape above, and not for two. */
const ONE_VISIT_QUOTA = 700;

describe("a storage that refuses the write", () => {
  let full: QuotaLimitedDailyRecordsStorage;
  let limited: MetricsStore;

  beforeEach(() => {
    full = new QuotaLimitedDailyRecordsStorage(ONE_VISIT_QUOTA);
    limited = createMetricsStore(full, new FixedClock(TODAY));
  });

  it("hands the refusal to its caller instead of losing it", async () => {
    // Arrange — the first visit fits
    await limited.recordPageVisit(visit({ tabId: 1 }));

    // Act & Assert — the second does not, and the caller is told so
    await expect(limited.recordPageVisit(visit({ tabId: 2 }))).rejects.toThrow(/quota/i);
  });

  it("keeps accepting writes after one was refused", async () => {
    // Arrange
    await limited.recordPageVisit(visit({ tabId: 1 }));
    await expect(limited.recordPageVisit(visit({ tabId: 2 }))).rejects.toThrow(/quota/i);

    // Act — the same visit again: an upsert, so the store still holds one
    await limited.recordPageVisit(
      visit({ tabId: 1, metrics: { ...visit().metrics, requestCount: 99 } }),
    );

    // Assert — a refused write must not stall the queue behind it
    expect(full.countVisits(TODAY)).toBe(1);
    expect((await limited.getDailyRecord()).visits[0].metrics.requestCount).toBe(99);
  });
});
