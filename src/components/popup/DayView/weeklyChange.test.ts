import { describe, it, expect } from "vitest";
import { computeWeeklyChange } from "./weeklyChange";
import { createEmptyDailyRecord } from "../../../session/aggregator";
import type { DailyRecord } from "../../../session/types";

const TODAY = new Date("2026-09-15T18:00:00");

const day = (date: string, totalCo2: number): DailyRecord => {
  const record = createEmptyDailyRecord(date);
  return { ...record, totalCarbon: { ...record.totalCarbon, totalCo2 } };
};

/** Fourteen days ending today, each worth the same, so a change is unambiguous. */
const fortnight = (currentDaily: number, previousDaily: number): DailyRecord[] => {
  const days: DailyRecord[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(TODAY);
    date.setDate(date.getDate() - offset);
    days.push(day(date.toLocaleDateString("sv"), offset >= 7 ? previousDaily : currentDaily));
  }
  return days;
};

describe("computeWeeklyChange", () => {
  it("reports nothing until storage reaches back over both windows", () => {
    // Arrange — ten days of history: the previous week is only half observed
    const days = fortnight(10, 20).slice(4);

    // Act & Assert — "−50 %" against a half-window would measure the window, not the browsing
    expect(computeWeeklyChange(days, TODAY).comparable).toBe(false);
  });

  it("compares the seven days ending today with the seven before them", () => {
    // Act — 7 × 10 g against 7 × 20 g
    const change = computeWeeklyChange(fortnight(10, 20), TODAY);

    // Assert
    expect(change.comparable).toBe(true);
    expect(change.comparable && change.currentTotal).toBeCloseTo(70, 10);
    expect(change.comparable && change.previousTotal).toBeCloseTo(140, 10);
    expect(change.comparable && change.ratio).toBeCloseTo(-0.5, 10);
  });

  it("reports a rise as a positive ratio", () => {
    // Act
    const change = computeWeeklyChange(fortnight(30, 20), TODAY);

    // Assert
    expect(change.comparable && change.ratio).toBeCloseTo(0.5, 10);
  });

  it("counts a day nobody browsed as a real zero, not as missing data", () => {
    // Arrange — a gap inside an otherwise covered fortnight
    const days = fortnight(10, 20).filter((each) => each.date !== "2026-09-11");

    // Act
    const change = computeWeeklyChange(days, TODAY);

    // Assert — absence inside the span is a quiet day; only coverage decides comparability
    expect(change.comparable).toBe(true);
    expect(change.comparable && change.currentTotal).toBeCloseTo(60, 10);
  });

  it("ignores days older than the two windows", () => {
    // Arrange
    const days = [day("2026-01-01", 900), ...fortnight(10, 20)];

    // Act
    const change = computeWeeklyChange(days, TODAY);

    // Assert
    expect(change.comparable && change.previousTotal).toBeCloseTo(140, 10);
  });

  it("reports nothing when the previous week measured nothing at all", () => {
    // Arrange — covered, but a week at zero has no ratio to express
    const change = computeWeeklyChange(fortnight(10, 0), TODAY);

    // Act & Assert
    expect(change.comparable).toBe(false);
  });

  it("reports nothing for an empty storage", () => {
    // Act & Assert
    expect(computeWeeklyChange([], TODAY).comparable).toBe(false);
  });
});
