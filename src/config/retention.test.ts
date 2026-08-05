import { describe, it, expect } from "vitest";
import { KEEP_EVERYTHING, resetPeriodMinutes } from "./retention";

const MINUTES_PER_DAY = 24 * 60;

describe("resetPeriodMinutes", () => {
  it("checks daily when only today is kept", () => {
    // Act & Assert
    expect(resetPeriodMinutes(1)).toBe(MINUTES_PER_DAY);
  });

  it("checks weekly for a rolling week — the cadence the removed enum expressed", () => {
    // Act & Assert
    expect(resetPeriodMinutes(7)).toBe(7 * MINUTES_PER_DAY);
  });

  it("derives a period for a window that had no enum case", () => {
    // Act & Assert — this is what removing ResetPeriod buys: no new type for 30 days
    expect(resetPeriodMinutes(30)).toBe(30 * MINUTES_PER_DAY);
  });

  it("still schedules a daily alarm when nothing is ever dropped", () => {
    // Act & Assert — the job returns early, but the alarm must remain valid
    expect(resetPeriodMinutes(KEEP_EVERYTHING)).toBe(MINUTES_PER_DAY);
  });

  it("never returns a period a browser would refuse", () => {
    // Arrange
    const windows = [KEEP_EVERYTHING, 0, 1, 7, 30, 365];

    // Act
    const periods = windows.map(resetPeriodMinutes);

    // Assert
    expect(periods.every((period) => period >= 1)).toBe(true);
  });
});
