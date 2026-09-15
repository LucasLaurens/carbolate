/**
 * The wizard for #46 seeds a day by hand, from a snippet pasted into a browser
 * console — where no import exists, so it restates the shape `session/types.ts`
 * owns. The duplication cannot be removed; it is held against the real readers
 * here instead, so a drifted snippet fails the suite rather than a manual
 * session already half-run across two browsers.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isKept, KEEP_EVERYTHING } from "../src/config/retention";
import { normalizeDailyRecord } from "../src/session/legacy";
import type { DailyRecord, DailyRecordsStore } from "../src/session/types";
import { toCSV } from "../src/utils/csv";

const WIZARD = new URL("../scripts/verify-csv-export.sh", import.meta.url);

const SEEDED_REQUESTS = 12;

/** The engines the wizard walks, and which global each one answers on. */
const ENGINES = ["chrome", "firefox"] as const;
type Engine = (typeof ENGINES)[number];

type StorageApi = {
  storage: {
    local: {
      get: (keys: readonly string[]) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
    };
  };
};

type SeedRun = (chrome: unknown, browser: unknown, console: unknown) => Promise<void>;

function readSeedSnippet(): string {
  const wizard = readFileSync(WIZARD, "utf8");
  const snippet = /^SEED_SNIPPET='([\s\S]*?)'$/m.exec(wizard);
  if (snippet === null) throw new Error("no SEED_SNIPPET in scripts/verify-csv-export.sh");
  return snippet[1];
}

/** A promise-returning `storage.local` — the form both engines expose. */
function createStorageApi(store: Record<string, unknown>): StorageApi {
  return {
    storage: {
      local: {
        get: (keys) =>
          Promise.resolve(
            Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, store[key]])),
          ),
        set: (items) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
      },
    },
  };
}

async function runSeedSnippet(engine: Engine): Promise<DailyRecordsStore> {
  const store: Record<string, unknown> = {};
  const api = createStorageApi(store);
  const run = new Function(
    "chrome",
    "browser",
    "console",
    `return ${readSeedSnippet()}`,
  ) as SeedRun;

  await run(engine === "chrome" ? api : undefined, engine === "firefox" ? api : undefined, {
    log: () => {},
  });

  return store.sessions as DailyRecordsStore;
}

const readSeededDay = (sessions: DailyRecordsStore): DailyRecord =>
  normalizeDailyRecord(Object.values(sessions)[0]);

describe("the #46 wizard's seed snippet", () => {
  it.each(ENGINES)("writes exactly one stored day on %s", async (engine) => {
    // Act
    const sessions = await runSeedSnippet(engine);

    // Assert — the ternary picks the global that engine actually defines
    expect(Object.keys(sessions)).toHaveLength(1);
  });

  it("lands its numbers where the normaliser reads them", async () => {
    // Arrange
    const sessions = await runSeedSnippet("chrome");

    // Act
    const day = readSeededDay(sessions);

    // Assert — totals are rebuilt from the visit, so a misnamed field reads zero
    expect(day.totalMetrics.requestCount).toBe(SEEDED_REQUESTS);
    expect(day.totalCarbon.totalCo2).toBeGreaterThan(0);
  });

  it("dates the day so a one-day window drops it", async () => {
    // Arrange
    const sessions = await runSeedSnippet("chrome");
    const { date } = readSeededDay(sessions);

    // Act & Assert — nothing to drop means no export: the reset cycle returns early
    expect(isKept(date, 1, new Date())).toBe(false);
    expect(isKept(date, KEEP_EVERYTHING, new Date())).toBe(true);
  });

  it("reaches the CSV as a single row", async () => {
    // Arrange
    const sessions = await runSeedSnippet("chrome");

    // Act
    const csv = toCSV([readSeededDay(sessions)]);

    // Assert
    const [header, ...rows] = csv.split("\n");
    expect(header.startsWith("date,domain,url,")).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("example.com");
  });
});
