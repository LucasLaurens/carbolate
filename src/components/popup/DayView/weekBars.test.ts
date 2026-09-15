import { describe, it, expect } from "vitest";
import { buildWeekBars, WEEK_LENGTH } from "./weekBars";
import { createEmptyDailyRecord } from "../../../session/aggregator";
import type { DailyRecord } from "../../../session/types";

const day = (date: string, totalCo2: number): DailyRecord => {
  const record = createEmptyDailyRecord(date);
  return { ...record, totalCarbon: { ...record.totalCarbon, totalCo2 } };
};

const TODAY = new Date("2026-09-15T18:00:00");

describe("buildWeekBars", () => {
  it("returns seven days ending on today, oldest first", () => {
    // Act
    const bars = buildWeekBars([], TODAY, "en");

    // Assert
    expect(bars).toHaveLength(WEEK_LENGTH);
    expect(bars[0].date).toBe("2026-09-09");
    expect(bars[WEEK_LENGTH - 1].date).toBe("2026-09-15");
  });

  it("marks only today, whatever the storage holds", () => {
    // Act
    const bars = buildWeekBars([day("2026-09-13", 40)], TODAY, "en");

    // Assert
    expect(bars.filter((bar) => bar.isToday).map((bar) => bar.date)).toEqual(["2026-09-15"]);
  });

  it("reports a stored day as measured, with its total and its sobriety colour", () => {
    // Act — 40 g is under half the 120 g anchor
    const [bar] = buildWeekBars([day("2026-09-09", 40)], TODAY, "en");

    // Assert
    expect(bar.measured).toBe(true);
    expect(bar.measured && bar.totalCo2).toBe(40);
    expect(bar.measured && bar.color).toBe("green");
  });

  it("reports a day absent from storage as unmeasured rather than as zero", () => {
    // Act
    const bars = buildWeekBars([day("2026-09-15", 40)], TODAY, "en");

    // Assert — a day nobody browsed is not a sober day
    expect(bars[0].measured).toBe(false);
    expect(bars[WEEK_LENGTH - 1].measured).toBe(true);
  });

  it("scales the tallest measured day to the full height", () => {
    // Act
    const bars = buildWeekBars([day("2026-09-14", 100), day("2026-09-15", 50)], TODAY, "en");
    const [, ...rest] = bars;
    const heights = rest
      .filter((bar) => bar.measured)
      .map((bar) => bar.measured && bar.heightPercent);

    // Assert
    expect(heights).toEqual([100, 50]);
  });

  it("keeps a nearly empty day visible instead of drawing nothing", () => {
    // Act
    const bars = buildWeekBars([day("2026-09-14", 500), day("2026-09-15", 0.2)], TODAY, "en");
    const today = bars[WEEK_LENGTH - 1];

    // Assert — 0.04 % of the tallest bar would be invisible
    expect(today.measured && today.heightPercent).toBeGreaterThanOrEqual(3);
  });

  it("ignores days outside the window, however many are stored", () => {
    // Act
    const bars = buildWeekBars([day("2026-08-01", 900), day("2026-09-15", 10)], TODAY, "en");

    // Assert — an old spike must not flatten the week it is not in
    expect(bars.every((bar) => bar.date >= "2026-09-09")).toBe(true);
    const today = bars[WEEK_LENGTH - 1];
    expect(today.measured && today.heightPercent).toBe(100);
  });

  it("labels each day in the panel's own language", () => {
    // Act
    const english = buildWeekBars([], TODAY, "en");
    const french = buildWeekBars([], TODAY, "fr");

    // Assert — 2026-09-15 is a Tuesday
    expect(english[WEEK_LENGTH - 1].label).toMatch(/^Tue/);
    expect(french[WEEK_LENGTH - 1].label).toMatch(/^mar/);
  });
});
