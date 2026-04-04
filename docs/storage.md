# Data schema and persistence

## Storage

All data is persisted in **`chrome.storage.local`** via `src/storage/ChromeStorage.ts`.

Two keys are used:

| Key | Type | Description |
|---|---|---|
| `"sessions"` | `SessionsStore` | Session history by day |
| `"preferences"` | `Preferences` | User configuration |

---

## TypeScript types

### `Preferences` — user configuration

Defined in **`src/config/preferences.ts`** (single source of truth — do not redefine elsewhere).

```typescript
type ResetPeriod = "daily" | "weekly";

type Preferences = {
  resetPeriod:           ResetPeriod; // "daily" | "weekly"
  retentionDays:         number;       // 1 = today only | 7 = 1 week | -1 = keep all
  autoExportBeforeReset: boolean;      // Export CSV before cleanup
};

const DEFAULT_PREFERENCES: Preferences = {
  resetPeriod: "daily",
  retentionDays: 1,
  autoExportBeforeReset: false,
};
```

> All modules (`ChromeStorage`, `Popup`, `PreferencesView`, `background`) import from `src/config/preferences.ts`. Never redefine this type locally.

---

### `Metrics` — raw metrics for a tab

```typescript
type Metrics = {
  requestCount:      number; // Number of HTTP/HTTPS requests
  totalResourceSize: number; // Total transferred size (MB)
  cpuTimeToLoad:     number; // Navigation duration (seconds)
};
```

### `MetricTab` — a tracked tab

```typescript
type MetricTab = {
  id:      number;  // chrome.tabs.Tab.id
  url:     string;  // Full URL
  domain:  string;  // hostname (e.g. "github.com"), "" if URL is invalid
  metrics: Metrics;
  meta: {
    status: number; // HTTP status (e.g. 200)
    date:   number; // Unix timestamp (ms) of the last collection
  };
  carbon: CarbonEstimate;
};
```

### `CarbonEstimate` — CO₂ calculation result

```typescript
type CarbonEstimate = {
  networkCo2: number; // gCO₂e emitted by the network
  cpuCo2:     number; // gCO₂e emitted by the CPU
  totalCo2:   number; // networkCo2 + cpuCo2
};
```

### `DailyRecord` — all data for a day

```typescript
type DailyRecord = {
  date:         string;        // "YYYY-MM-DD" in local time (via getDailyDate())
  tabs:         MetricTab[];   // Tabs tracked during the day
  totalMetrics: Metrics;       // Sum of metrics across all tabs
  totalCarbon:  CarbonEstimate;// Sum of carbon across all tabs
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
    "autoExportBeforeReset": false
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
metricsStore.addTab(tab)                               → void  (new tab)
metricsStore.updateTabMetrics(id, metrics, meta?)      → void  (update existing tab)
metricsStore.clearPastDays(retentionDays)              → void  (cleanup)
```

### Cutoff calculation in `clearPastDays`

The cutoff date is computed in **local time** via `toLocaleDateString("sv")` (locale "sv" = `YYYY-MM-DD` format), avoiding UTC offsets that could incorrectly delete or retain days.
