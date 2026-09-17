/**
 * `exportToCSV` against a real downloads API that happens to keep its requests
 * in memory. It covers what unit tests of `toCSV` could not: the URL form each
 * engine gets, the file name, and what a refused download does.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exportToCSV } from "./csv";
import { createEmptyDailyRecord } from "../session/aggregator";
import type { DailyRecord, PageVisit } from "../session/types";
import { FixedClock } from "../../test/fakes/FixedClock";
import { InMemoryDownloads, RefusingDownloads } from "../../test/fakes/InMemoryDownloads";

const TODAY = "2026-02-23";

const visit = (domain: string): PageVisit => ({
  tabId: 1,
  url: `https://${domain}/a,b`,
  domain,
  metrics: {
    requestCount: 12,
    thirdPartyRequests: 4,
    totalResourceSize: 1.5,
    pageLoadDurationSec: 2.4,
    visibleDurationSec: 30,
    cachedPageWeight: 0.8,
  },
  meta: { date: 1_772_000_000_000, observedFrom: 1_772_000_000_500 },
  carbon: {
    networkCo2: 0.26,
    deviceCo2: 0.0024,
    screenCo2: 0.0126,
    totalCo2: 0.275,
    avoidedCo2: 0.14,
  },
});

const day = (date: string): DailyRecord => ({
  ...createEmptyDailyRecord(date),
  visits: [visit("exemple-accentué.com")],
});

const chromeGlobal = globalThis as unknown as {
  chrome: { downloads?: unknown; runtime: { lastError?: { message: string } } };
};

let realCreateObjectURL: typeof URL.createObjectURL | undefined;

beforeEach(() => {
  realCreateObjectURL = URL.createObjectURL;
  chromeGlobal.chrome.runtime.lastError = undefined;
});

afterEach(() => {
  if (realCreateObjectURL === undefined) {
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
    return;
  }
  URL.createObjectURL = realCreateObjectURL;
});

describe("exportToCSV — where an MV3 service worker has no object URL", () => {
  beforeEach(() => {
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
  });

  it("hands the browser a data URL it can download from a worker", async () => {
    // Arrange
    const downloads = new InMemoryDownloads();
    chromeGlobal.chrome.downloads = downloads;

    // Act
    await exportToCSV([day(TODAY)], new FixedClock(TODAY));

    // Assert
    expect(downloads.requested).toHaveLength(1);
    expect(downloads.requested[0].url.startsWith("data:text/csv;charset=utf-8,")).toBe(true);
  });

  it("carries the CSV through the URL intact, commas and accents included", async () => {
    // Arrange
    const downloads = new InMemoryDownloads();
    chromeGlobal.chrome.downloads = downloads;

    // Act
    await exportToCSV([day(TODAY)], new FixedClock(TODAY));

    // Assert — percent-encoding is what makes a quoted URL survive the round trip
    const csv = decodeURIComponent(downloads.requested[0].url.split(",").slice(1).join(","));
    expect(csv).toContain("exemple-accentué.com");
    expect(csv).toContain('"https://exemple-accentué.com/a,b"');
  });

  it("names the file after the day it was exported", async () => {
    // Arrange
    const downloads = new InMemoryDownloads();
    chromeGlobal.chrome.downloads = downloads;

    // Act
    await exportToCSV([day(TODAY)], new FixedClock(TODAY));

    // Assert
    expect(downloads.requested[0].filename).toBe(`carbolate-export-${TODAY}.csv`);
  });
});

describe("exportToCSV — where the context has an object URL", () => {
  it("prefers a blob URL, chosen by capability and never by engine", async () => {
    // Arrange
    const downloads = new InMemoryDownloads();
    chromeGlobal.chrome.downloads = downloads;
    URL.createObjectURL = () => "blob:carbolate/fake";

    // Act
    await exportToCSV([day(TODAY)], new FixedClock(TODAY));

    // Assert
    expect(downloads.requested[0].url).toBe("blob:carbolate/fake");
  });
});

describe("exportToCSV — when the browser refuses", () => {
  it("rejects with the browser's own message, so the reset can abort", async () => {
    // Arrange
    chromeGlobal.chrome.downloads = new RefusingDownloads("user cancelled");

    // Act & Assert — a silent failure here would drop days with nothing exported
    await expect(exportToCSV([day(TODAY)], new FixedClock(TODAY))).rejects.toThrow(
      "user cancelled",
    );
  });
});
