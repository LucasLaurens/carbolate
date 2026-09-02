# Data schema and persistence

## Storage

All data is persisted in **`chrome.storage.local`** via `src/storage/ChromeStorage.ts`.

Two keys are used:

| Key             | Type                | Description                  |
| --------------- | ------------------- | ---------------------------- |
| `"sessions"`    | `DailyRecordsStore` | Daily record history, by day |
| `"preferences"` | `Preferences`       | User configuration           |

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
type Preferences = {
  retentionDays: number; // 1 = today only | 7 = 1 week | 30, 60… | -1 = keep all
  autoExportBeforeReset: boolean; // Export CSV before cleanup
  language: Language; // "en" | "fr"
};

const DEFAULT_PREFERENCES: Preferences = {
  retentionDays: 1,
  autoExportBeforeReset: false,
  language: "en",
};
```

> All modules (`ChromeStorage`, `Popup`, `SettingsView`, `background`) import from `src/config/preferences.ts`. Never redefine this type locally.

> `ResetPeriod` (`"daily" | "weekly"`) is **gone**. It duplicated `retentionDays`,
> which made the pair `{ resetPeriod: "weekly", retentionDays: 1 }` representable and
> meaningless, and left `-1` with no period at all. `retentionDays` is now the single
> source of truth, and the reset alarm's period **derives** from it via
> `computeResetPeriodMinutes()` in `src/config/retention.ts`. Any window — `1`, `7`, `30`,
> `-1` — needs no new type. A residual `resetPeriod` left in storage is ignored:
> `getPreferences()` merges over `DEFAULT_PREFERENCES`, so no migration is needed.
> See [the units and retention ADR](decisions/2026-08-05-unites-et-retention.md).

---

### `Metrics` — raw metrics for a tab

```typescript
type Metrics = {
  requestCount: number; // Number of HTTP/HTTPS requests
  totalResourceSize: number; // Transferred data (MB, base 10 — 10⁶ bytes)
  pageLoadDurationSec: number; // Navigation duration (seconds) — wall clock, not CPU
  cachedPageWeight: number; // Uncompressed MB the cache served — feeds avoided CO₂ only
};
```

> `pageLoadDurationSec` was named `cpuTimeToLoad`, which promised a CPU measurement
> it never made. `cachedPageWeight` is a **decoded** size while `totalResourceSize`
> is a **transferred** one: the asymmetry is deliberate, since what the cache spared
> is what the transfer would have weighed.

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
  networkCo2: number; // gCO₂e — transmission networks + data centres
  deviceCo2: number; // gCO₂e — the user's machine during page load
  totalCo2: number; // networkCo2 + deviceCo2
  avoidedCo2: number; // gCO₂e the cache spared — NEVER inside totalCo2
};
```

> `cpuCo2` and `renderingCo2` are merged into `deviceCo2`. They multiplied the same
> duration by two coefficients, so their sum **is** the device figure and no stored
> day changes value. `avoidedCo2` is summed like the others and stays out of
> `totalCo2`: subtracting it would let a well-cached site report a negative
> footprint.

> The neutral elements `createEmptyMetrics()` / `createEmptyCarbonEstimate()` are **derived from
> the sums** rather than written out again — see `src/session/aggregator.ts` and its
> test. The sums themselves carry no `?? 0` fallback any more: normalisation happens
> once, at the storage boundary (below).

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
            "pageLoadDurationSec": 1.8,
            "cachedPageWeight": 1.2
          },
          "meta": {
            "date": 1741046400000
          },
          "carbon": {
            "networkCo2": 0.605,
            "deviceCo2": 0.0025,
            "totalCo2": 0.6075,
            "avoidedCo2": 0.212
          }
        }
      ],
      "totalMetrics": {
        "requestCount": 87,
        "totalResourceSize": 3.42,
        "pageLoadDurationSec": 1.8,
        "cachedPageWeight": 1.2
      },
      "totalCarbon": {
        "networkCo2": 0.605,
        "deviceCo2": 0.0025,
        "totalCo2": 0.6075,
        "avoidedCo2": 0.212
      }
    }
  },
  "preferences": {
    "retentionDays": 1,
    "autoExportBeforeReset": false,
    "language": "en"
  }
}
```

---

## Reading records written by an older version

`src/session/legacy.ts` is the **single door** stored bytes come through. Three
carbon shapes have been persisted and all three are still out there on installed
extensions:

| Stored shape                         | Read as                                        |
| ------------------------------------ | ---------------------------------------------- |
| `cpuCo2` alone                       | `deviceCo2 = cpuCo2`                           |
| `cpuCo2` + `renderingCo2`            | `deviceCo2 = cpuCo2 + renderingCo2` (lossless) |
| `deviceCo2`                          | unchanged                                      |
| `cpuTimeToLoad`                      | `pageLoadDurationSec`                          |
| no `avoidedCo2` / `cachedPageWeight` | `0` — unrecoverable, and zero invents nothing  |

`normalizeDailyRecords()` runs on every `getSessions()` read inside the metrics
store, so **every** record above that line carries the current shape whichever
version wrote it. Day totals are **rebuilt from the normalised tabs** rather than
normalised on their own, so a stored total that disagrees with its parts — an update
interrupted mid-write — is corrected instead of carried forward.

Nothing is written back: storage keeps its old shape until the next real write. The
`?? 0` fallbacks that used to sit in `sumCarbonEstimates` and in the CSV export are
gone, because a fallback repeated in three modules is three chances to be one field
behind.

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
`createEmptyDailyRecord(date)`, so no caller carries a "no record" branch. Reading a day
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
