import { beforeEach } from "vitest";

// In-memory store reset before every test
let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
});

// Minimal chrome.storage.local mock
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: (keys: string[], callback: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        keys.forEach((key) => {
          if (store[key] !== undefined) result[key] = store[key];
        });
        callback(result);
      },
      set: (items: Record<string, unknown>, callback: () => void) => {
        Object.assign(store, items);
        callback();
      },
    },
  },
};
