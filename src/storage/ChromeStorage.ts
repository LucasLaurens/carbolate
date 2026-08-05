import { DEFAULT_PREFERENCES } from "../config/preferences";
import type { Preferences } from "../config/types";
import type { DailyRecordsStore } from "../session/types";
import { StorageKey } from "./StorageKey";
import type { BrowsingDataStore, StorageData } from "./types";

export const ChromeStorage: BrowsingDataStore = {
  getSessions: (): Promise<DailyRecordsStore> =>
    new Promise((resolve, reject) =>
      chrome.storage.local.get([StorageKey.SESSIONS], (result) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve((result as Partial<StorageData>).sessions ?? {});
      }),
    ),

  setSessions: (sessions: DailyRecordsStore): Promise<void> =>
    new Promise((resolve, reject) =>
      chrome.storage.local.set({ [StorageKey.SESSIONS]: sessions }, () => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve();
      }),
    ),

  getPreferences: (): Promise<Preferences> =>
    new Promise((resolve, reject) =>
      chrome.storage.local.get([StorageKey.PREFERENCES], (result) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve({
          ...DEFAULT_PREFERENCES,
          ...((result as Partial<StorageData>).preferences ?? {}),
        });
      }),
    ),

  setPreferences: (preferences: Preferences): Promise<void> =>
    new Promise((resolve, reject) =>
      chrome.storage.local.set({ [StorageKey.PREFERENCES]: preferences }, () => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve();
      }),
    ),
};
