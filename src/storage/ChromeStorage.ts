import { DEFAULT_PREFERENCES } from "../config/preferences";
import type { Preferences } from "../config/types";
import type { SessionsStore } from "../session/types";
import type { BrowsingDataStore, StorageData } from "./types";

export const ChromeStorage: BrowsingDataStore = {
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
