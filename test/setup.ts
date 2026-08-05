import { beforeEach } from "vitest";

/**
 * Minimal `chrome.storage.local` backing, for the tests that exercise the real
 * `ChromeStorage` adapter. Everything above that adapter is constructed with an
 * in-memory storage, so it needs no global at all — and no reset hook.
 */
let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
});

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
