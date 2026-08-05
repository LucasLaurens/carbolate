import { describe, it, expect } from "vitest";
import { compareToDailyReference } from "./worldComparison";
import { DAILY_BROWSING_REFERENCE_G_CO2 } from "./constants";

const REFERENCE = DAILY_BROWSING_REFERENCE_G_CO2;

describe("compareToDailyReference", () => {
  it("places a day at half the reference well below it", () => {
    // Act & Assert
    expect(compareToDailyReference(REFERENCE * 0.2)).toBe("wellBelow");
  });

  it("places a day just under the reference below it", () => {
    // Act & Assert
    expect(compareToDailyReference(REFERENCE * 0.7)).toBe("below");
  });

  it("places the reference itself around it", () => {
    // Act & Assert
    expect(compareToDailyReference(REFERENCE)).toBe("around");
  });

  it("keeps a small deviation inside the around band", () => {
    // Act & Assert — the band exists so a 20–25 % perimeter bias cannot flip a verdict
    expect(compareToDailyReference(REFERENCE * 0.95)).toBe("around");
    expect(compareToDailyReference(REFERENCE * 1.05)).toBe("around");
  });

  it("places a clearly heavier day above it", () => {
    // Act & Assert
    expect(compareToDailyReference(REFERENCE * 1.5)).toBe("above");
  });

  it("places a day past twice the reference well above it", () => {
    // Act & Assert
    expect(compareToDailyReference(REFERENCE * 3)).toBe("wellAbove");
  });

  it("never yields a number, so no false precision can reach the panel", () => {
    // Arrange
    const positions = [0, REFERENCE * 0.5, REFERENCE, REFERENCE * 10].map(compareToDailyReference);

    // Assert
    expect(positions.every((position) => typeof position === "string")).toBe(true);
  });
});
