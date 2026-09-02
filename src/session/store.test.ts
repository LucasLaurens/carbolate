import { describe, it, expect, beforeEach } from "vitest";
import { createMetricsStore } from "./store";
import type { MetricsStore } from "./types";
import { createEmptyDailyRecord } from "./aggregator";
import { KEEP_EVERYTHING } from "../config/retention";
import { InMemoryDailyRecordsStorage } from "../../test/fakes/InMemoryDailyRecordsStorage";
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
