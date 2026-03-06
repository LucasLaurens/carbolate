import type { SessionsStore } from "../session/types";
import type { Preferences } from "../config/types";

export type StorageData = {
  sessions: SessionsStore;
  preferences: Preferences;
};

export interface BrowsingDataStore {
  getSessions(): Promise<SessionsStore>;
  setSessions(sessions: SessionsStore): Promise<void>;
  getPreferences(): Promise<Preferences>;
  setPreferences(preferences: Preferences): Promise<void>;
}
