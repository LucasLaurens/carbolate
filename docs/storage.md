# Data schema and persistence

## Storage

All data is persisted in **`chrome.storage.local`** via `src/storage/ChromeStorage.ts`.

Two keys are used:

| Key             | Type                 | Description                  |
| --------------- | -------------------- | ---------------------------- |
| `"sessions"`    | `DailyRecordsStore`  | Daily record history, by day  |
| `"preferences"` | `Preferences`        | User configuration            |

The key strings live in `src/storage/StorageKey.ts`. `"sessions"` holds **daily
records**, not browsing sessions — the key keeps its historical name so an
installed extension does not lose its data, and the mismatch is carried by
`docs/glossary.md` instead of being rediscovered from the code.

Types defined in `src/storage/types.ts`:

```typescript
type StorageData = {
  [StorageKey.SESSIONS]: DailyRecordsStore;
  [StorageKey.PREFERENCES]: Preferences;
};
```

---

## TypeScript types

### `Preferences` — user configuration

Defined in **`src/config/preferences.ts`** (single source of truth — do not redefine elsewhere).

```typescript
type ResetPeriod = "daily" | "weekly";

type Preferences = {
  resetPeriod: ResetPeriod; // "daily" | "weekly"
  retentionDays: number; // 1 = today only | 7 = 1 week | -1 = keep all
  autoExportBeforeReset: boolean; // Export CSV before cleanup
  language: Language; // "en" | "fr"
};

const DEFAULT_PREFERENCES: Preferences = {
  resetPeriod: "daily",
  retentionDays: 1,
  autoExportBeforeReset: false,
  language: "en",
};
```

> All modules (`ChromeStorage`, `Popup`, `SettingsView`, `background`) import from `src/config/preferences.ts`. Never redefine this type locally.

---

### `Metrics` — raw metrics for a tab

```typescript
type Metrics = {
  requestCount: number; // Number of HTTP/HTTPS requests
  totalResourceSize: number; // Total transferred size (MB, base 10 — 10⁶ bytes)
  cpuTimeToLoad: number; // Navigation duration (seconds) — wall clock, not CPU
};
```

> Unit conversions go through `src/utils/bytes.ts` — the single home for the
> base-10 rule. `Metrics` is adapted to `CarbonInput` by
> `src/carbon/toCarbonInput.ts`, and `MetricsIntake` is its only production
> caller: the figure shown and the figure costed therefore come from the same
> stored value and cannot drift apart by a rounding step.

### `MetricTab` — a tracked tab

```typescript
type MetricTab = {
  id: number; // chrome.tabs.Tab.id
  url: string; // Full URL, as first observed for this tab
  domain: string; // hostname (e.g. "github.com") — a visit with no valid host is discarded
  metrics: Metrics;
  meta: {
    date: number; // Unix timestamp (ms) of the last collection
  };
  carbon: CarbonEstimate;
};
```

> `meta.status` is gone. It was hardcoded to `200`, never read and never anything
> else — a field claiming to describe a state while describing none. The real
> lifecycle it stood in for is specified in
> [the page-visit ADR](decisions/2026-08-05-page-visit-unite-de-mesure.md) and is
> not implemented yet. Stored records that still carry the field are simply
> ignored on read; no migration is needed.

### `CarbonEstimate` — CO₂ calculation result

```typescript
type CarbonEstimate = {
  networkCo2: number; // gCO₂e — transmission networks + data centers
  cpuCo2: number; // gCO₂e — device energy during page load
  renderingCo2: number; // gCO₂e — GPU/display during page load
  totalCo2: number; // networkCo2 + cpuCo2 + renderingCo2
};
```

> Records persisted before `renderingCo2` existed lack the field. `sumCarbonEstimates`
> reads it tolerantly (`?? 0`) so a legacy day does not total to `NaN`. The neutral
> elements `emptyMetrics()` / `emptyCarbonEstimate()` are **derived from the sums**
> rather than written out again — see `src/session/aggregator.ts` and its test.

### `DailyRecord` — all data for a day

```typescript
type DailyRecord = {
  date: string; // "YYYY-MM-DD" in local time (via getDailyDate())
  tabs: MetricTab[]; // Tabs tracked during the day
  totalMetrics: Metrics; // Sum of metrics across all tabs
  totalCarbon: CarbonEstimate; // Sum of carbon across all tabs
};
```

### `DailyRecordsStore` — dictionary of days

```typescript
type DailyRecordsStore = Record<string, DailyRecord>;
// Example: { "2026-03-04": DailyRecord, "2026-03-03": DailyRecord }
```

---

## Full payload example

```json
{
  "sessions": {
    "2026-03-04": {
      "date": "2026-03-04",
      "tabs": [
        {
          "id": 42,
          "url": "https://github.com/anthropics/claude-code",
          "domain": "github.com",
          "metrics": {
            "requestCount": 87,
            "totalResourceSize": 3.42,
            "cpuTimeToLoad": 1.8
          },
          "meta": {
            "date": 1741046400000
          },
          "carbon": {
            "networkCo2": 1,
            "cpuCo2": 0,
            "totalCo2": 1
          }
        }
      ],
      "totalMetrics": {
        "requestCount": 87,
        "totalResourceSize": 3.42,
        "cpuTimeToLoad": 1.8
      },
      "totalCarbon": {
        "networkCo2": 1,
        "cpuCo2": 0,
        "totalCo2": 1
      }
    }
  },
  "preferences": {
    "resetPeriod": "daily",
    "retentionDays": 1,
    "autoExportBeforeReset": false,
    "language": "en"
  }
}
```

---

## ChromeStorage API

`ChromeStorage` implements `BrowsingDataStore`, itself the intersection of two
role interfaces so each caller depends only on the half it needs.

```typescript
interface DailyRecordsStorage {
  getSessions(): Promise<DailyRecordsStore>;
  setSessions(sessions: DailyRecordsStore): Promise<void>;
}

interface PreferencesStorage {
  getPreferences(): Promise<Preferences>;
  setPreferences(preferences: Preferences): Promise<void>;
}

interface BrowsingDataStore extends DailyRecordsStorage, PreferencesStorage {}
```

The metrics store takes `DailyRecordsStorage`; the panel takes `PreferencesStorage`.
`InMemoryDailyRecordsStorage` (`test/fakes/`) is the second real implementation of
the first — a concrete storage that keeps its bytes in a variable, never a
configured stub.

> **Important**: `setSessions` performs a **full replacement** — always read before writing to avoid losing other days. Inside the store, every write goes through the single `mutateToday` critical section, which does exactly that.

---

## Metrics store API

The store is **constructed**, not imported as a singleton:

```typescript
const store = createMetricsStore(ChromeStorage, new SystemClock());
```

It keeps an **in-memory cache** of the current `DailyRecord`. A write warms the
cache with the value just persisted; `clearPastDays` drops it. Repeated reads
while the panel is open cost one I/O call.

```typescript
// DailyRecordReader — the panel's half
store.getDailyRecord()  → DailyRecord     (today; the neutral record if nothing was measured)
store.getAllDays()      → DailyRecord[]   (every stored day, chronological)

// TabMetricsRecorder — the intake's half
store.recordTabMetrics(tab) → void        (upsert on tab id, inside the write queue)

// RetentionEnforcer — the reset alarm's half
store.clearPastDays(retentionDays) → void
```

`getDailyRecord()` never returns `null`: a day nothing was measured on is
`emptyDailyRecord(date)`, so no caller carries a "no record" branch. Reading a day
does **not** create it — a query never writes.

### Why one write method, not three

`recordTabMetrics` replaced `hasExistingTabById()` + `addTab()` +
`updateTabMetrics()`. The caller used to ask whether the tab existed **outside**
the write queue and then enqueue one of two writes, so two messages for the same
tab could both read `false` and both append — one page visit stored twice, day
total inflated. Read, decide and write now happen in a single queued turn.

The four remaining readers of that old interface (`findOrCreateDailyRecord`,
`getTabs`, `getTotalMetrics`, `getTotalCarbon`) had no production caller at all;
they existed so tests could look inside the store, alongside a
`globalThis.__carbolateCacheReset` hook shipped in production code. Both are gone:
a constructed store is fresh per test by definition.

### Cutoff calculation in `clearPastDays`

The cutoff date is computed in **local time** via `toDailyDate()`
(`toLocaleDateString("sv")`, the only locale whose short date is ISO `YYYY-MM-DD`),
avoiding UTC offsets that could incorrectly delete or retain days. Today is never
dropped, however short the window.
