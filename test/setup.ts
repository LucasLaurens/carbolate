import { beforeEach } from "vitest";
import { resetClock } from "../src/utils/clock";

// In-memory store reset before every test
let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  resetClock();
  (globalThis as Record<string, unknown | (() => void)>).__carbolateCacheReset?.(); // resets store.ts in-memory cache
});

// Minimal chrome.storage.local mock
(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: { lastError: undefined },
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
