/**
 * What an installed extension already has in storage must survive an update.
 *
 * These are not hypothetical shapes: `cpuCo2` alone shipped, then `cpuCo2` +
 * `renderingCo2`, and both are still sitting in `chrome.storage.local` on every
 * machine that has the extension. A reader that assumed today's fields would
 * total those days to NaN.
 */
import { describe, it, expect } from "vitest";
import { normalizeDailyRecord, normalizeDailyRecords } from "./legacy";
import { emptyCarbonEstimate, emptyDailyRecord, emptyMetrics } from "./aggregator";
import type { DailyRecord } from "./types";

const TODAY = "2026-02-23";

/** The shape written before `renderingCo2` existed. */
const cpuOnlyTab = {
  id: 1,
  url: "https://example.com/a",
  domain: "example.com",
  meta: { date: 1_700_000_000_000 },
  metrics: { requestCount: 12, totalResourceSize: 1.5, cpuTimeToLoad: 2.4 },
  carbon: { networkCo2: 0.26, cpuCo2: 0.0024, totalCo2: 0.2624 },
};

/** The shape written once `renderingCo2` had been added. */
const splitFactorTab = {
  id: 2,
  url: "https://example.com/b",
  domain: "example.com",
  meta: { date: 1_700_000_001_000 },
  metrics: { requestCount: 4, totalResourceSize: 0.5, cpuTimeToLoad: 1 },
  carbon: { networkCo2: 0.088, cpuCo2: 0.001, renderingCo2: 0.0004, totalCo2: 0.0894 },
};

const storedDay = (tabs: unknown[]) =>
  ({ date: TODAY, tabs }) as unknown as Parameters<typeof normalizeDailyRecord>[0];

describe("a record written before deviceCo2 existed", () => {
  it("folds cpuCo2 and renderingCo2 into one device figure", () => {
    // Act
    const record = normalizeDailyRecord(storedDay([splitFactorTab]));

    // Assert — 0.001 + 0.0004, the sum the two coefficients always described
    expect(record.tabs[0].carbon.deviceCo2).toBeCloseTo(0.0014, 10);
  });

  it("treats a missing renderingCo2 as nothing rather than as NaN", () => {
    // Act
    const record = normalizeDailyRecord(storedDay([cpuOnlyTab]));

    // Assert
    expect(record.tabs[0].carbon.deviceCo2).toBeCloseTo(0.0024, 10);
    expect(Number.isNaN(record.totalCarbon.totalCo2)).toBe(false);
  });

  it("keeps the total a legacy day already showed", () => {
    // Act
    const record = normalizeDailyRecord(storedDay([splitFactorTab]));

    // Assert — merging the factors must not move what the user saw yesterday
    expect(record.tabs[0].carbon.totalCo2).toBeCloseTo(0.0894, 10);
  });

  it("reports no avoided CO₂ for a day that never measured it", () => {
    // Act
    const record = normalizeDailyRecord(storedDay([cpuOnlyTab]));

    // Assert — it cannot be recovered from what was stored, and zero invents nothing
    expect(record.tabs[0].carbon.avoidedCo2).toBe(0);
    expect(record.totalCarbon.avoidedCo2).toBe(0);
  });
});

describe("a record written before pageLoadDurationSec was named that", () => {
  it("reads the old cpuTimeToLoad as the load duration it always was", () => {
    // Act
    const record = normalizeDailyRecord(storedDay([cpuOnlyTab]));

    // Assert
    expect(record.tabs[0].metrics.pageLoadDurationSec).toBeCloseTo(2.4, 10);
  });

  it("reports no cached page weight for a day that never measured it", () => {
    // Act
    const record = normalizeDailyRecord(storedDay([cpuOnlyTab]));

    // Assert
    expect(record.tabs[0].metrics.cachedPageWeight).toBe(0);
  });
});

describe("totals are rebuilt, not trusted", () => {
  it("adds the day up from its own tabs", () => {
    // Act
    const record = normalizeDailyRecord(storedDay([cpuOnlyTab, splitFactorTab]));

    // Assert
    expect(record.totalMetrics.requestCount).toBe(16);
    expect(record.totalCarbon.totalCo2).toBeCloseTo(0.2624 + 0.0894, 10);
  });

  it("corrects a stored total that disagrees with its tabs", () => {
    // Arrange — an update interrupted between the tab write and the total write
    const corrupted = {
      date: TODAY,
      tabs: [cpuOnlyTab],
      totalMetrics: { requestCount: 999, totalResourceSize: 999, cpuTimeToLoad: 999 },
      totalCarbon: { networkCo2: 999, cpuCo2: 999, totalCo2: 999 },
    } as unknown as Parameters<typeof normalizeDailyRecord>[0];

    // Act
    const record = normalizeDailyRecord(corrupted);

    // Assert
    expect(record.totalMetrics.requestCount).toBe(12);
    expect(record.totalCarbon.totalCo2).toBeCloseTo(0.2624, 10);
  });
});

describe("shapes that are not merely old but broken", () => {
  it("reads a day with no tabs array as an empty day", () => {
    // Act
    const record = normalizeDailyRecord({ date: TODAY });

    // Assert
    expect(record.tabs).toEqual([]);
    expect(record.totalMetrics).toEqual(emptyMetrics());
    expect(record.totalCarbon).toEqual(emptyCarbonEstimate());
  });

  it("substitutes zero for a field stored as something that is not a number", () => {
    // Arrange
    const damaged = storedDay([
      { ...cpuOnlyTab, carbon: { networkCo2: Number.NaN, cpuCo2: 0.002, totalCo2: Number.NaN } },
    ]);

    // Act
    const record = normalizeDailyRecord(damaged);

    // Assert
    expect(record.tabs[0].carbon.networkCo2).toBe(0);
    expect(Number.isNaN(record.totalCarbon.totalCo2)).toBe(false);
  });

  it("leaves a record already in today's shape untouched", () => {
    // Arrange
    const current: DailyRecord = emptyDailyRecord(TODAY);

    // Act
    const record = normalizeDailyRecord(current);

    // Assert
    expect(record).toEqual(current);
  });
});

describe("normalizing the whole store", () => {
  it("normalizes every day and keeps their keys", () => {
    // Arrange
    const stored = {
      "2026-02-22": storedDay([cpuOnlyTab]),
      [TODAY]: storedDay([splitFactorTab]),
    } as never;

    // Act
    const records = normalizeDailyRecords(stored);

    // Assert
    expect(Object.keys(records).sort()).toEqual(["2026-02-22", TODAY]);
    expect(records["2026-02-22"].tabs[0].carbon.deviceCo2).toBeCloseTo(0.0024, 10);
    expect(records[TODAY].tabs[0].carbon.deviceCo2).toBeCloseTo(0.0014, 10);
  });

  it("reads an empty store as an empty store", () => {
    // Act & Assert
    expect(normalizeDailyRecords({})).toEqual({});
  });
});
