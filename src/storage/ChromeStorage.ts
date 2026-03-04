import type { SessionsStore } from "../session/types";
import { DEFAULT_PREFERENCES, type Preferences } from "../config/preferences";

type StorageData = {
  sessions: SessionsStore;
  preferences: Preferences;
};

export interface IStorage {
  getSessions(): Promise<SessionsStore>;
  setSessions(sessions: SessionsStore): Promise<void>;
  getPreferences(): Promise<Preferences>;
  setPreferences(preferences: Preferences): Promise<void>;
}

export const ChromeStorage: IStorage = {
  getSessions: (): Promise<SessionsStore> =>
    new Promise((resolve, reject) =>
      chrome.storage.local.get(["sessions"], (result) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve((result as Partial<StorageData>).sessions ?? {});
      }),
    ),

  setSessions: (sessions: SessionsStore): Promise<void> =>
    new Promise((resolve, reject) =>
      chrome.storage.local.set({ sessions }, () => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve();
      }),
    ),

  getPreferences: (): Promise<Preferences> =>
    new Promise((resolve, reject) =>
      chrome.storage.local.get(["preferences"], (result) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve({
          ...DEFAULT_PREFERENCES,
          ...((result as Partial<StorageData>).preferences ?? {}),
        });
      }),
    ),

  setPreferences: (preferences: Preferences): Promise<void> =>
    new Promise((resolve, reject) =>
      chrome.storage.local.set({ preferences }, () => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve();
      }),
    ),
};
