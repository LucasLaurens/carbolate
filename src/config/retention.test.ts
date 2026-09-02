import { describe, it, expect } from "vitest";
import { KEEP_EVERYTHING, RETENTION_OPTIONS, isKept, computeResetPeriodMinutes } from "./retention";

const MINUTES_PER_DAY = 24 * 60;

describe("computeResetPeriodMinutes", () => {
  it("checks daily when only today is kept", () => {
    // Act & Assert
    expect(computeResetPeriodMinutes(1)).toBe(MINUTES_PER_DAY);
  });

  it("checks weekly for a rolling week — the cadence the removed enum expressed", () => {
    // Act & Assert
    expect(computeResetPeriodMinutes(7)).toBe(7 * MINUTES_PER_DAY);
  });

  it("derives a period for a window that had no enum case", () => {
    // Act & Assert — this is what removing ResetPeriod buys: no new type for 30 days
    expect(computeResetPeriodMinutes(30)).toBe(30 * MINUTES_PER_DAY);
  });

  it("still schedules a daily alarm when nothing is ever dropped", () => {
    // Act & Assert — the job returns early, but the alarm must remain valid
    expect(computeResetPeriodMinutes(KEEP_EVERYTHING)).toBe(MINUTES_PER_DAY);
  });

  it("never returns a period a browser would refuse", () => {
    // Arrange
    const windows = [KEEP_EVERYTHING, 0, 1, 7, 30, 365];

    // Act
    const periods = windows.map(computeResetPeriodMinutes);

    // Assert
    expect(periods.every((period) => period >= 1)).toBe(true);
  });
});

describe("isKept", () => {
  const TODAY = new Date("2026-08-21T12:00:00");

  it("keeps exactly one day for a one-day window", () => {
    // Act & Assert — `>=` on the cutoff used to keep yesterday too
    expect(isKept("2026-08-21", 1, TODAY)).toBe(true);
    expect(isKept("2026-08-20", 1, TODAY)).toBe(false);
  });

  it("keeps exactly seven days for a rolling week", () => {
    // Act & Assert — the boundary resetCycle.test.ts sidestepped
    expect(isKept("2026-08-15", 7, TODAY)).toBe(true);
    expect(isKept("2026-08-14", 7, TODAY)).toBe(false);
  });

  it("keeps every day when nothing is ever dropped", () => {
    // Act & Assert
    expect(isKept("2020-01-01", KEEP_EVERYTHING, TODAY)).toBe(true);
  });

  it("never drops the current day, whatever the window", () => {
    // Arrange — a window of 0 puts the cutoff past today
    const windows = [0, -2, 1, 7];

    // Act
    const kept = windows.map((window) => isKept("2026-08-21", window, TODAY));

    // Assert
    expect(kept.every(Boolean)).toBe(true);
  });

  it("counts the window in local days, not in 24h spans", () => {
    // Arrange — 23:30 local, an hour before the day rolls over
    const lateEvening = new Date("2026-08-21T23:30:00");

    // Act & Assert
    expect(isKept("2026-08-15", 7, lateEvening)).toBe(true);
    expect(isKept("2026-08-14", 7, lateEvening)).toBe(false);
  });
});

describe("RETENTION_OPTIONS", () => {
  it("offers the three windows the panel exposes, widest last", () => {
    // Act & Assert
    expect(RETENTION_OPTIONS).toEqual([1, 7, KEEP_EVERYTHING]);
  });
});
