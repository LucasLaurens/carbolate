import type { SessionsStore } from "../session/types";

type StorageData = {
  sessions: SessionsStore;
};

export const ChromeStorage = {
  getSessions: (): Promise<SessionsStore> =>
    new Promise((resolve) =>
      chrome.storage.local.get(["sessions"], (result: Partial<StorageData>) =>
        resolve(result.sessions ?? {}),
      ),
    ),

  setSessions: (sessions: SessionsStore): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.set({ sessions }, resolve)),
};
