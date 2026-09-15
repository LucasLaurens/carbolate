import { describe, it, expect } from "vitest";
import {
  formatBadgeText,
  resolveBadgeColor,
  refreshBadge,
  EMPTY_BADGE_COLOR,
  SOBRIETY_HEX,
} from "./badge";
import type { BadgeSurface } from "./badge";
import { createEmptyMetrics } from "../session/aggregator";
import { createMetricsStore } from "../session/store";
import type { MetricTab } from "../session/types";
import { en, fr } from "../i18n";
import { InMemoryDailyRecordsStorage } from "../../test/fakes/InMemoryDailyRecordsStorage";
import { FixedClock } from "../../test/fakes/FixedClock";
import { gradeSobrietyLevel } from "../carbon/sobriety";
import type { SobrietyLevel } from "../carbon/sobriety";

/** WCAG 2.1 relative luminance, from the hex the badge actually paints. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast of white badge text — the only text colour both engines default to. */
function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

const WCAG_AA = 4.5;

describe("formatBadgeText", () => {
  it("shows a dash when nothing was measured", () => {
    // Act & Assert
    expect(formatBadgeText(0)).toBe("–");
  });

  it("shows a dash only for a true zero, never for a rounding to zero", () => {
    // Act & Assert
    expect(formatBadgeText(0.4)).toBe("<1");
  });

  it("rounds to a whole gram under a kilogram", () => {
    // Act & Assert
    expect(formatBadgeText(132.6)).toBe("133");
  });

  it("switches to one decimal in kilograms from a kilogram up", () => {
    // Act & Assert
    expect(formatBadgeText(1240)).toBe("1.2k");
  });

  it("drops the decimal where it would overflow four characters", () => {
    // Arrange — 9.95k rounds to "10.0k", five characters Chrome would truncate
    // Act & Assert
    expect(formatBadgeText(9_960)).toBe("10k");
    expect(formatBadgeText(12_400)).toBe("12k");
  });
});

describe("badge palette", () => {
  const LEVELS: readonly SobrietyLevel[] = ["sober", "moderate", "intensive", "excessive"];

  it("paints every grade", () => {
    // Act & Assert
    expect(Object.keys(SOBRIETY_HEX).sort()).toEqual([...LEVELS].sort());
  });

  it("keeps white badge text readable on every colour it paints", () => {
    // Arrange
    const painted = [...Object.values(SOBRIETY_HEX), EMPTY_BADGE_COLOR];

    // Act & Assert — the Tailwind 500 family fails this; the 700 family passes
    for (const hex of painted) {
      expect(contrastWithWhite(hex)).toBeGreaterThanOrEqual(WCAG_AA);
    }
  });

  it("derives the colour from the grade the model gives, not from the total", () => {
    // Act & Assert
    expect(resolveBadgeColor(gradeSobrietyLevel(42))).toBe(SOBRIETY_HEX.sober);
    expect(resolveBadgeColor(gradeSobrietyLevel(1240))).toBe(SOBRIETY_HEX.excessive);
  });
});

describe("refreshBadge", () => {
  const TODAY = "2026-08-21";

  /** A real badge surface whose pixels are three variables. */
  class RecordingBadge implements BadgeSurface {
    text = "";
    backgroundColor = "";
    title = "";

    setText = (text: string): void => {
      this.text = text;
    };
    setBackgroundColor = (color: string): void => {
      this.backgroundColor = color;
    };
    setTitle = (title: string): void => {
      this.title = title;
    };
  }

  const measuredTab = (totalCo2: number): MetricTab => ({
    id: 1,
    url: "https://example.test/page",
    domain: "example.test",
    metrics: createEmptyMetrics(),
    meta: { date: new Date(`${TODAY}T12:00:00`).getTime() },
    carbon: { networkCo2: totalCo2, deviceCo2: 0, screenCo2: 0, totalCo2, avoidedCo2: 0 },
  });

  const storeOf = (storage: InMemoryDailyRecordsStorage) =>
    createMetricsStore(storage, new FixedClock(TODAY));

  it("grades the day's total, in the language the panel is set to", async () => {
    // Arrange
    const store = storeOf(new InMemoryDailyRecordsStorage());
    await store.recordTabMetrics(measuredTab(133));
    const badge = new RecordingBadge();

    // Act
    await refreshBadge(store, badge, fr);

    // Assert
    expect(badge.text).toBe("133");
    expect(badge.backgroundColor).toBe(SOBRIETY_HEX.moderate);
    expect(badge.title).toBe("Carbolate — 133 g aujourd'hui · Modéré");
  });

  it("says nothing was measured instead of grading an absence of data", async () => {
    // Arrange
    const store = storeOf(new InMemoryDailyRecordsStorage());
    const badge = new RecordingBadge();

    // Act
    await refreshBadge(store, badge, en);

    // Assert
    expect(badge.text).toBe("–");
    expect(badge.backgroundColor).toBe(EMPTY_BADGE_COLOR);
    expect(badge.title).toBe("Carbolate — nothing measured today");
  });

  it("spells the unit out in the tooltip a badge cannot carry", async () => {
    // Arrange — under a gram the badge only has room for "<1"
    const store = storeOf(new InMemoryDailyRecordsStorage());
    await store.recordTabMetrics(measuredTab(0.42));
    const badge = new RecordingBadge();

    // Act
    await refreshBadge(store, badge, en);

    // Assert
    expect(badge.text).toBe("<1");
    expect(badge.title).toBe("Carbolate — 0.42 g today · Sober");
  });
});
