import type { SessionsStore } from "../session/types";

export type Preferences = {
  retentionDays: number; // 1 = today only, 7 = keep a week, -1 = keep all
  autoExportBeforeReset: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  retentionDays: 1,
  autoExportBeforeReset: false,
};

type StorageData = {
  sessions: SessionsStore;
  preferences: Preferences;
};

export const ChromeStorage = {
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
        resolve({ ...DEFAULT_PREFERENCES, ...((result as Partial<StorageData>).preferences ?? {}) });
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
