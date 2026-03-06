# Technical architecture

## File structure

```
src/
├── main.tsx                        # React entry point
├── App.tsx                         # Root component → <Popup />
├── global.d.ts                     # Module declaration for *.css
│
├── config/
│   └── preferences.ts              # Single source of truth: Preferences, ResetPeriod, DEFAULT_PREFERENCES
│
├── background/
│   └── index.ts                    # Chrome background service worker — reset alarm + metrics reception
│
├── content/
│   └── index.ts                    # Content script (injected on every page) — pushes metrics to background
│
├── components/
│   └── popup/
│       ├── Popup.tsx               # Main component, storage reads, global state management
│       ├── DayView.tsx             # "Today" view + domain chart
│       └── PreferencesView.tsx     # "Preferences" view
│
├── carbon/
│   ├── CarbonCalculator.ts         # CO₂ calculation engine (accepts CarbonContributionSource[])
│   ├── CarbonContributionSource.ts # OCP interface for emission sources
│   ├── constants.ts                # Calibration constants
│   ├── types.ts                    # CarbonInput, CarbonEstimate, Carbon<I,O>
│   └── sources/
│       ├── NetworkCarbonSource.ts  # Network emissions (implements CarbonContributionSource)
│       └── CpuCarbonSource.ts      # CPU emissions (implements CarbonContributionSource)
│
├── session/
│   ├── store.ts                    # metricsStore — CRUD DailyRecord + in-memory cache
│   ├── aggregator.ts               # sumMetrics, sumCarbonEstimates
│   └── types.ts                    # Metrics, MetricTab, DailyRecord, SessionsStore, MetricsStore
│
├── storage/
│   └── ChromeStorage.ts            # chrome.storage.local abstraction (implements IStorage)
│
├── performance/
│   ├── StrategyContext.ts          # Strategy context (pattern)
│   ├── ResourceStrategy.ts         # Network resource analysis strategy
│   ├── EntriesValidator.ts         # Validates that "resource" entries exist
│   ├── contracts/                  # Resource, Strategy<I,O> interfaces
│   └── enums/                      # EntriesEnum, ResourceInitiatorTypeEnum
│
└── utils/
    ├── date.ts                     # getDailyDate (timezone-safe), isToday, isThisWeek (Monday=start)
    ├── url.ts                      # parseDomain — safe wrapper around new URL()
    └── csv.ts                      # exportToCSV
```

---

## Full data flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Web page (new tab loaded)                  │
│  performance.getEntriesByType("resource")   → network       │
│  performance.getEntriesByType("navigation") → CPU/timing    │
└──────────────────────┬──────────────────────────────────────┘
                       │ serialized as plain objects
                       │ chrome.runtime.sendMessage({ type: "page_metrics", ... })
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Content Script (content/index.ts)        │
│  Triggered on window.load (or document.readyState=complete) │
│  Converts PerformanceEntry → serializable plain objects     │
│    resource   : [{ transferSize }]                          │
│    navigation : [{ duration }]                              │
│  Sends chrome.runtime.sendMessage → Background              │
└──────────────────────┬──────────────────────────────────────┘
                       │ "page_metrics" message + sender.tab.{id, url}
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Background (background/index.ts)         │
│                                                             │
│  1. EntriesValidator → validates that "resource" is not empty│
│  2. StrategyContext(ResourceStrategy)                       │
│     → { resourceCount, totalTransferSize }                  │
│  3. Builds Metrics { requestCount, totalResourceSize,       │
│     cpuTimeToLoad }                                         │
│  4. parseDomain(sender.tab.url) → safe hostname             │
│  5. hasExistingTabById?                                     │
│    ├─ No  → metricsStore.addTab(...)                        │
│    └─ Yes → metricsStore.updateTabMetrics(...)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    metricsStore (session/store.ts)          │
│                                                             │
│  In-memory cache (DailyRecord + date):                      │
│    → Read : returns cache if date = today                   │
│    → Write: invalidates the cache                           │
│                                                             │
│  addTab / updateTabMetrics                                  │
│    → CarbonCalculator.calculate([CarbonInput])              │
│      → [NetworkCarbonSource, CpuCarbonSource]               │
│    → { networkCo2, cpuCo2, totalCo2 }                       │
│    → sumMetrics(tabs) + sumCarbonEstimates(tabs)            │
│    → DailyRecord { date, tabs[], totalMetrics, totalCarbon }│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               ChromeStorage (chrome.storage.local)         │
│                                                             │
│  Key "sessions"     → SessionsStore (Record<date, DailyRecord>)│
│  Key "preferences"  → Preferences (source: config/preferences.ts)│
└──────────────────────┬──────────────────────────────────────┘
                       │ read-only
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Popup (Popup.tsx)                        │
│                                                             │
│  componentDidMount → metricsStore.findDailyRecord()         │
│  "Refresh" button  → metricsStore.findDailyRecord()         │
│  Displays DayView with today's DailyRecord                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Architectural patterns

### Strategy Pattern
`StrategyContext<Input, Output>` allows plugging in different performance analysis strategies. Currently: `ResourceStrategy` which computes `resourceCount` and `totalTransferSize`.

```typescript
const ctx = new StrategyContext(new ResourceStrategy());
const result = ctx.execute(resourceEntries); // { resourceCount, totalTransferSize }
```

Extensible: additional strategies can be added for PAINT, LONGTASK, etc.

### Open/Closed — CarbonContributionSource
`CarbonCalculator` accepts an array of emission sources. Adding a new source (e.g. GPU, streaming) does not require modifying `CarbonCalculator`:

```typescript
// Adding a source without touching the calculator
class GpuCarbonSource implements CarbonContributionSource {
  calculate(inputs: CarbonInput[]): number { ... }
}
const calc = new CarbonCalculator([
  new NetworkCarbonSource(),
  new CpuCarbonSource(),
  new GpuCarbonSource(), // ← added here only
]);
```

### Store Pattern + in-memory cache
`metricsStore` exposes a high-level API for managing `DailyRecord` objects. Repeated reads within the same session (popup open) use an in-memory cache invalidated on every write — avoids redundant I/O to `chrome.storage.local`.

### Background / Popup / Content separation
- The **Background script** runs persistently in the background → collects metrics sent by content scripts, manages alarms and periodic resets
- The **Popup** mounts/unmounts on every open → reads storage only (pure read)
- The **Content script** is injected on every page → collects Performance API data on load and pushes it to the background

---

## Required manifest (permissions)

For the extension to work, the following permissions are required in `manifest.json`:

```json
{
  "permissions": [
    "storage",
    "alarms",
    "tabs",
    "scripting",
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
    "sidePanel",
    "contextMenus"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

> **Note**: `"downloads"` is currently missing from the manifest, which prevents CSV export (`chrome.downloads.download` in `utils/csv.ts`). Needs to be added to enable export.

### Why `"type": "module"` on the background

The `background.js` bundle generated by Vite/Rollup uses ES module `import` statements (shared chunks in `assets/`). Without `"type": "module"`, Chrome runs the service worker in classic script mode and throws a `SyntaxError`. With this flag, the service worker is an ES module and can import its dependencies normally.

### Why `content.js` is different

Chrome **does not support** ES modules in content scripts. `content.js` is therefore bundled with no external `import` statements: all dependencies are inlined at Vite build time, producing a self-contained script.
