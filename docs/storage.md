# Data schema and persistence

## Storage

All data is persisted in **`chrome.storage.local`** via `src/storage/ChromeStorage.ts`.

Two keys are used:

| Key             | Type            | Description            |
| --------------- | --------------- | ---------------------- |
| `"sessions"`    | `SessionsStore` | Session history by day |
| `"preferences"` | `Preferences`   | User configuration     |

Types defined in `src/storage/types.ts`:

```typescript
type StorageData = {
  sessions: SessionsStore;
  preferences: Preferences;
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
> `src/carbon/toCarbonInput.ts`, imported by both the background and the tests so
> a unit change cannot land in one without the other.

### `MetricTab` — a tracked tab

```typescript
type MetricTab = {
  id: number; // chrome.tabs.Tab.id
  url: string; // Full URL
  domain: string; // hostname (e.g. "github.com"), "" if URL is invalid
  metrics: Metrics;
  meta: {
    status: number; // HTTP status (e.g. 200)
    date: number; // Unix timestamp (ms) of the last collection
  };
  carbon: CarbonEstimate;
};
```

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

### `SessionsStore` — dictionary of days

```typescript
type SessionsStore = Record<string, DailyRecord>;
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
            "status": 200,
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

`ChromeStorage` implements the `BrowsingDataStore` interface (mockable for tests).

```typescript
interface BrowsingDataStore {
  getSessions(): Promise<SessionsStore>;
  setSessions(sessions: SessionsStore): Promise<void>;
  getPreferences(): Promise<Preferences>;
  setPreferences(preferences: Preferences): Promise<void>;
}
```

```typescript
// Read sessions
ChromeStorage.getSessions(): Promise<SessionsStore>

// Full write (full replace)
ChromeStorage.setSessions(sessions: SessionsStore): Promise<void>

// Read preferences (merged with defaults from config/preferences.ts)
ChromeStorage.getPreferences(): Promise<Preferences>

// Write preferences
ChromeStorage.setPreferences(preferences: Preferences): Promise<void>
```

> **Important**: `setSessions` performs a **full replacement** — always read before writing to avoid losing other days.

---

## metricsStore API

`metricsStore` maintains an **in-memory cache** of the current `DailyRecord`. The cache is invalidated automatically on every write. Repeated reads (during a popup session) result in only one I/O call.

```typescript
// Read (in-memory cache for the current day)
metricsStore.findDailyRecord()         → DailyRecord | null   (current day)
metricsStore.findOrCreateDailyRecord() → DailyRecord          (creates if missing)
metricsStore.getAllDays()              → DailyRecord[]         (all days, sorted)
metricsStore.getTabs()                 → MetricTab[]           (today's tabs)
metricsStore.getTotalMetrics()         → Metrics               (today's totals)
metricsStore.getTotalCarbon()          → CarbonEstimate        (today's CO₂)
metricsStore.hasExistingTabById(id)    → boolean

// Write (invalidates the cache)
metricsStore.addTab(tab)                                    → void  (new tab)
metricsStore.updateTabMetrics(id, metrics, carbon, meta?)   → void  (update existing tab)
metricsStore.clearPastDays(retentionDays)                   → void  (cleanup)
```

### Cutoff calculation in `clearPastDays`

The cutoff date is computed in **local time** via `toLocaleDateString("sv")` (locale "sv" = `YYYY-MM-DD` format), avoiding UTC offsets that could incorrectly delete or retain days.
