import { describe, it, expect, beforeEach } from "vitest";
import { runResetCycle } from "./resetCycle";
import { DEFAULT_PREFERENCES } from "../config/preferences";
import type { Preferences } from "../config/types";
import { createEmptyDailyRecord } from "../session/aggregator";
import { createMetricsStore } from "../session/store";
import type { DailyRecord, MetricsStore } from "../session/types";
import { InMemoryDailyRecordsStorage } from "../../test/fakes/InMemoryDailyRecordsStorage";
import { FixedClock } from "../../test/fakes/FixedClock";

const TODAY = "2026-02-23";
// Three days back, so a `retentionDays` of 1 drops it whatever the cutoff rounding.
const PAST_DAY = "2026-02-20";
const KEEP_TODAY_ONLY = 1;
const NOW = new Date(`${TODAY}T12:00:00`);

/** A real exporter whose destination is a variable instead of the Downloads folder. */
class InMemoryExporter {
  readonly exports: DailyRecord[][] = [];

  export = (records: readonly DailyRecord[]): Promise<void> => {
    this.exports.push([...records]);
    return Promise.resolve();
  };
}

/** The failure the reset must survive: the browser refused the download. */
class RefusingExporter {
  attempts = 0;

  export = (): Promise<void> => {
    this.attempts += 1;
    return Promise.reject(new Error("downloads API refused the URL"));
  };
}

const preferences = (autoExportBeforeReset: boolean): Preferences => ({
  ...DEFAULT_PREFERENCES,
  retentionDays: KEEP_TODAY_ONLY,
  autoExportBeforeReset,
});

let storage: InMemoryDailyRecordsStorage;
let store: MetricsStore;

beforeEach(() => {
  storage = new InMemoryDailyRecordsStorage();
  storage.seedDay(PAST_DAY, createEmptyDailyRecord(PAST_DAY));
  storage.seedDay(TODAY, createEmptyDailyRecord(TODAY));
  store = createMetricsStore(storage, new FixedClock(TODAY));
});

describe("runResetCycle", () => {
  it("exports every stored day before the deletion drops any of them", async () => {
    // Arrange
    const exporter = new InMemoryExporter();

    // Act
    await runResetCycle(store, exporter.export, preferences(true), NOW);

    // Assert
    expect(exporter.exports).toHaveLength(1);
    expect(exporter.exports[0].map((record) => record.date)).toEqual([PAST_DAY, TODAY]);
    expect(storage.dates()).toEqual([TODAY]);
  });

  it("keeps every day when the export fails, so nothing is lost silently", async () => {
    // Arrange
    const exporter = new RefusingExporter();

    // Act
    const cycle = runResetCycle(store, exporter.export, preferences(true), NOW);

    // Assert
    await expect(cycle).rejects.toThrow("downloads API refused the URL");
    expect(exporter.attempts).toBe(1);
    expect(storage.dates()).toEqual([PAST_DAY, TODAY]);
  });

  it("deletes without exporting when the preference is off", async () => {
    // Arrange
    const exporter = new InMemoryExporter();

    // Act
    await runResetCycle(store, exporter.export, preferences(false), NOW);

    // Assert
    expect(exporter.exports).toEqual([]);
    expect(storage.dates()).toEqual([TODAY]);
  });
  it("exports nothing when the window drops nothing", async () => {
    // Arrange — a store already inside its window: only today is stored
    const emptied = new InMemoryDailyRecordsStorage();
    emptied.seedDay(TODAY, createEmptyDailyRecord(TODAY));
    const exporter = new InMemoryExporter();

    // Act
    await runResetCycle(
      createMetricsStore(emptied, new FixedClock(TODAY)),
      exporter.export,
      preferences(true),
      NOW,
    );

    // Assert — a download with no deletion behind it is noise the user did not ask for
    expect(exporter.exports).toEqual([]);
    expect(emptied.dates()).toEqual([TODAY]);
  });
});
