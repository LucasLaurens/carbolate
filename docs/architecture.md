# Technical architecture

## File structure

```
src/
├── main.tsx                        # React entry point
├── App.tsx                         # Root component → <Popup />
├── App.css                         # Global styles
├── global.d.ts                     # Module declaration for *.css
│
├── config/
│   ├── types.ts                    # ResetPeriod, Preferences types
│   └── preferences.ts              # Single source of truth: DEFAULT_PREFERENCES
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
│       ├── DayView/
│       │   ├── index.tsx           # Daily dashboard — stats grid + domain chart
│       │   ├── types.ts            # StatColor, DomainData types
│       │   ├── StatsGrid.tsx       # 2×2 card grid (CO₂, data, requests, tabs)
│       │   ├── DomainChart.tsx     # Doughnut chart — top 5 domains by CO₂
│       │   └── utils.ts            # formatCo2(), aggregateDomains(), COLOR_CLASSES
│       └── SettingsView.tsx        # Preferences form
│
├── carbon/
│   ├── types.ts                    # CarbonInput, CarbonEstimate, FootprintCalculator
│   ├── constants.ts                # CARBON_PER_GB (176.8), CPU_FACTOR (0.001), RENDERING_FACTOR (0.0004), WORLD_DAILY_BROWSING_G_CO2 (120)
│   ├── CarbonCalculator.ts         # CO₂ calculation engine (accepts CarbonContributionSource[])
│   └── contracts/
│       └── CarbonContributionSource.ts  # OCP interface for emission sources
│   └── sources/
│       ├── NetworkCarbonSource.ts  # Network + data center emissions
│       ├── CpuCarbonSource.ts      # Device CPU energy during page load
│       └── RenderingCarbonSource.ts # GPU/display rendering energy during page load
│
├── session/
│   ├── types.ts                    # Metrics, MetricTab, DailyRecord, SessionsStore, MetricsStore
│   ├── store.ts                    # metricsStore — CRUD DailyRecord + in-memory cache
│   └── aggregator.ts               # sumMetrics, sumCarbonEstimates
│
├── performance/
│   ├── types.ts                    # ExtractedMetrics (resourceCount, totalTransferSize)
│   ├── contracts/
│   │   ├── MetricsExtractor.ts     # Interface: handle(input[]) → Output
│   │   └── NetworkResource.ts      # Interface: { transferSize }
│   ├── enums/
│   │   ├── PerformanceEntryType.ts      # RESOURCE, NAVIGATION, PAINT, LONGTASK
│   │   └── ResourceInitiatorType.ts     # BEACON, BODY, FETCH, FRAME, etc.
│   ├── NetworkMetricsExtractor.ts  # Sums resource counts & transfer sizes
│   ├── MetricsProcessorContext.ts  # Strategy context: holds extractor, delegates execution
│   └── PageMetricsValidator.ts     # Validates that "resource" entries exist
│
├── i18n/
│   ├── types.ts                    # Language, CarbonLevelKey, Translations, EquivalenceTranslations types
│   ├── index.ts                    # getTranslations(lang) — language registry
│   ├── en.ts                       # English translations
│   └── fr.ts                       # French translations
│
├── security/
│   └── RateLimiter.ts              # Rate limiter for UI actions — quadratic throttle on excess calls
│
├── storage/
│   ├── ChromeStorage.ts            # chrome.storage.local abstraction (implements BrowsingDataStore)
│   └── types.ts                    # StorageData, BrowsingDataStore interface
│
└── utils/
    ├── date.ts                     # getDailyDate (timezone-safe), isToday, isThisWeek
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
│  1. PageMetricsValidator → validates "resource" not empty   │
│  2. MetricsProcessorContext(NetworkMetricsExtractor)        │
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
`MetricsProcessorContext<Input, Output>` allows plugging in different performance analysis strategies. Currently: `NetworkMetricsExtractor` which computes `resourceCount` and `totalTransferSize`.

```typescript
const ctx = new MetricsProcessorContext(new NetworkMetricsExtractor());
const result = ctx.execute(resourceEntries); // { resourceCount, totalTransferSize }
```

Extensible: additional extractors can be added for PAINT, LONGTASK analysis without modifying the background.

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

### Security — RateLimiter
`RateLimiter` (`src/security/RateLimiter.ts`) protects all side-effecting UI actions (export, refresh, storage writes) from abuse. Each action has its own counter, scoped by string key.

- **Window**: 60 seconds, 10 calls max
- **Throttle**: quadratic on excess — delay grows as `excess² × 1s` (1s, 4s, 9s…)
- **Usage**: one `RateLimiter` instance per UI context (popup, side panel), passed to action handlers

```typescript
const limiter = new RateLimiter();
if (!limiter.isAllowed("csv-export")) return;
```

`page_metrics` messages from the content script are **not** rate-limited — every page load is a valid data point.

### Background / Popup / Content separation
- The **Background script** runs persistently → collects metrics sent by content scripts, manages alarms and periodic resets
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

The `background.js` bundle generated by Vite/Rollup uses ES module `import` statements. Without `"type": "module"`, Chrome runs the service worker in classic script mode and throws a `SyntaxError`.

### Why `content.js` is different

Chrome **does not support** ES modules in content scripts. `content.js` is therefore bundled with no external `import` statements: all dependencies are inlined at Vite build time, producing a self-contained script.
