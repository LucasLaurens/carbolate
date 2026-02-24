import type { SessionsStore } from "../session/types";

type StorageData = {
  sessions: SessionsStore;
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
};
