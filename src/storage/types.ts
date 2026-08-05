import type { DailyRecordsStore } from "../session/types";
import type { Preferences } from "../config/types";
import type { StorageKey } from "./StorageKey";

export type StorageData = {
  [StorageKey.SESSIONS]: DailyRecordsStore;
  [StorageKey.PREFERENCES]: Preferences;
};

/** The measurement half of the storage — all the metrics store may touch. */
export interface DailyRecordsStorage {
  getSessions(): Promise<DailyRecordsStore>;
  setSessions(sessions: DailyRecordsStore): Promise<void>;
}

/** The preferences half — all the panel's settings need. */
export interface PreferencesStorage {
  getPreferences(): Promise<Preferences>;
  setPreferences(preferences: Preferences): Promise<void>;
}

export interface BrowsingDataStore extends DailyRecordsStorage, PreferencesStorage {}
