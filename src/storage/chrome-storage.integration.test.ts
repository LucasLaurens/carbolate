/**
 * The real `ChromeStorage` adapter against the `chrome.storage.local` stub from
 * test/setup.ts. It used to be covered only transitively, through the store.
 */
import { describe, it, expect } from "vitest";
import { ChromeStorage } from "./ChromeStorage";
import { StorageKey } from "./StorageKey";
import { DEFAULT_PREFERENCES } from "../config/preferences";
import { createEmptyDailyRecord } from "../session/aggregator";

describe("daily records", () => {
  it("reads an empty set before anything was written", async () => {
    // Act & Assert
    expect(await ChromeStorage.getSessions()).toEqual({});
  });

  it("round-trips what it was given", async () => {
    // Arrange
    const sessions = { "2026-02-23": createEmptyDailyRecord("2026-02-23") };

    // Act
    await ChromeStorage.setSessions(sessions);

    // Assert
    expect(await ChromeStorage.getSessions()).toEqual(sessions);
  });

  it("writes under the historical key installed extensions already use", async () => {
    // Act
    await ChromeStorage.setSessions({ "2026-02-23": createEmptyDailyRecord("2026-02-23") });

    // Assert
    expect(StorageKey.SESSIONS).toBe("sessions");
    expect(await ChromeStorage.getSessions()).toHaveProperty("2026-02-23");
  });
});

describe("preferences", () => {
  it("falls back to the defaults when nothing was stored", async () => {
    // Act & Assert
    expect(await ChromeStorage.getPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips a saved preference", async () => {
    // Arrange
    const preferences = { ...DEFAULT_PREFERENCES, language: "fr" as const };

    // Act
    await ChromeStorage.setPreferences(preferences);

    // Assert
    expect(await ChromeStorage.getPreferences()).toEqual(preferences);
  });

  it("fills a field absent from an older stored shape", async () => {
    // Arrange — a preferences object written before `language` existed
    await ChromeStorage.setPreferences({ retentionDays: 7 } as never);

    // Act
    const preferences = await ChromeStorage.getPreferences();

    // Assert
    expect(preferences.retentionDays).toBe(7);
    expect(preferences.language).toBe(DEFAULT_PREFERENCES.language);
  });
});
