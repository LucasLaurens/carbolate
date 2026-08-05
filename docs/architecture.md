# Technical architecture

## File structure

```
src/
├── main.tsx                        # React entry point
├── App.tsx                         # Panel composition root — builds the store and clock, renders <Popup />
├── App.css                         # Global styles
├── global.d.ts                     # Module declaration for *.css
│
├── config/
│   ├── types.ts                    # ResetPeriod, Preferences types
│   └── preferences.ts              # Single source of truth: DEFAULT_PREFERENCES
│
├── background/
│   └── index.ts                    # Chrome adapter: alarms, badge, message listener → MetricsIntake
│
├── intake/
│   └── MetricsIntake.ts            # The one path from an observed page load to a stored, costed record
│
├── content/
│   ├── index.ts                    # Content script wiring — builds the collector, fires it on load
│   ├── MetricsCollector.ts         # Collection rules + the PerformanceSource / ObservationSink ports
│   ├── BrowserPerformanceSource.ts # Adapter: the real Performance API, projected onto plain objects
│   └── RuntimeObservationSink.ts   # Adapter: chrome.runtime.sendMessage
│
├── messaging/
│   └── messages.ts                 # MessageType, PageMetricsMessage, isPageMetricsMessage guard
│
├── components/
│   └── popup/
│       ├── Popup.tsx               # Panel shell — receives store, storage and clock as props
│       ├── DayView/
│       │   ├── index.tsx           # Daily dashboard — stats grid + domain chart
│       │   ├── types.ts            # StatColor, DomainData types
│       │   ├── StatsGrid.tsx       # CO₂ card + metrics strip (tabs, requests, data)
│       │   ├── DomainChart.tsx     # Doughnut chart — top 5 domains by CO₂
│       │   └── utils.ts            # formatCo2(), aggregateDomains(), COLOR_CLASSES
│       └── SettingsView.tsx        # Preferences form
│
├── carbon/
│   ├── types.ts                    # CarbonInput, CarbonEstimate, FootprintCalculator
│   ├── constants.ts                # CARBON_PER_GB (176.8), CPU_FACTOR (0.001), RENDERING_FACTOR (0.0004), WORLD_DAILY_BROWSING_G_CO2 (120)
│   ├── CarbonCalculator.ts         # CO₂ calculation engine (accepts CarbonContributionSource[])
│   ├── toCarbonInput.ts            # Adapter: stored Metrics (MB, s) → CarbonInput (bytes, ms)
│   ├── contracts/
│   │   └── CarbonContributionSource.ts  # OCP interface for emission sources
│   └── sources/
│       ├── NetworkCarbonSource.ts  # Network + data center emissions
│       ├── CpuCarbonSource.ts      # Device CPU energy during page load
│       └── RenderingCarbonSource.ts # GPU/display rendering energy during page load
│
├── session/
│   ├── types.ts                    # Metrics, MetricTab, DailyRecord, DailyRecordsStore + the store's role interfaces
│   ├── store.ts                    # createMetricsStore(storage, clock) — one write queue, one cache
│   └── aggregator.ts               # sumMetrics, sumCarbonEstimates, the neutral elements
│
├── performance/
│   ├── PageMetrics.ts              # measurePage(payload) → PageMeasurementResult (requests, bytes, ms)
│   └── enums/
│       └── PerformanceEntryType.ts # RESOURCE, NAVIGATION — the getEntriesByType() strings
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
│   ├── StorageKey.ts               # SESSIONS, PREFERENCES — the storage key strings
│   └── types.ts                    # StorageData + DailyRecordsStorage / PreferencesStorage roles
│
└── utils/
    ├── bytes.ts                    # Byte and duration conversions — base 10 only
    ├── clock.ts                    # Clock interface, SystemClock, toDailyDate()
    ├── url.ts                      # parseDomain — safe wrapper around new URL()
    └── csv.ts                      # toCSV (pure) + exportToCSV (download)
```

Test doubles live in `test/fakes/` — `FixedClock`, `InMemoryDailyRecordsStorage`. They are
real implementations of the same interfaces, never configured stubs, and they ship in no bundle.

---

## Full data flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Web page (load event fired)                │
│  BrowserPerformanceSource — adapter over the Performance API │
│    getEntriesByType("resource")   → [{ transferSize }]      │
│    getEntriesByType("navigation") → [{ duration }]          │
│  Host objects are projected onto plain objects: Chrome's     │
│  structured clone refuses to serialize the entries as-is.    │
└──────────────────────┬──────────────────────────────────────┘
                       │ PerformanceSource port
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              MetricsCollector (content/MetricsCollector.ts)  │
│  Holds the collection rules. Both globals sit behind ports,  │
│  so the rules are assertable without a DOM or a browser.     │
│  collect() → ObservationSink.send(PagePerformancePayload)    │
└──────────────────────┬──────────────────────────────────────┘
                       │ RuntimeObservationSink adapter
                       │ PageMetricsMessage { type, payload }
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Background (background/index.ts) — Chrome adapter    │
│                                                             │
│  isPageMetricsMessage(message)  ← guards the message shape   │
│  tabId  = sender.tab?.id                                     │
│  url    = sender.url ?? sender.tab?.url                      │
│  → MetricsIntake.record({ tabId, url, payload })              │
│                                                             │
│  Also owns: reset alarm, BETA badge. Nothing else.            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                MetricsIntake (intake/MetricsIntake.ts)       │
│                                                             │
│  1. parseDomain(url)      → discard if not http(s)          │
│  2. measurePage(payload)  → discard if no resource entry    │
│     → { requests, transferredBytes, loadDurationMs }        │
│  3. Metrics { requestCount, totalResourceSize (MB),         │
│     cpuTimeToLoad (s) }                                      │
│  4. toCarbonInput(metrics) → CarbonCalculator.calculate()    │
│     → [Network, Cpu, Rendering] CarbonSource                │
│  5. recorder.recordTabMetrics(tab)                           │
│                                                             │
│  Injected: TabMetricsRecorder, FootprintCalculator, Clock    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          metrics store (session/store.ts) — constructed      │
│                                                             │
│  createMetricsStore(storage, clock)                          │
│                                                             │
│  recordTabMetrics — upsert INSIDE the write queue:           │
│    read day → decide add-or-replace → persist, serialised    │
│    → sumMetrics(tabs) + sumCarbonEstimates(tabs)             │
│    → DailyRecord { date, tabs[], totalMetrics, totalCarbon } │
│                                                             │
│  getDailyRecord — never null: an unmeasured day is the        │
│    neutral record from emptyDailyRecord(date)                 │
│                                                             │
│  In-memory cache, warmed on write, dropped by clearPastDays  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               ChromeStorage (chrome.storage.local)          │
│                                                             │
│  StorageKey.SESSIONS    → DailyRecordsStore (by local day)  │
│  StorageKey.PREFERENCES → Preferences (config/preferences.ts)│
└──────────────────────┬──────────────────────────────────────┘
                       │ read-only on measurements
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Panel (App.tsx → Popup.tsx)              │
│                                                             │
│  App.tsx is the composition root: builds the clock and the  │
│  store, passes them in as props.                            │
│  Popup receives a DailyRecordReader — it cannot write a     │
│  measurement even by accident.                              │
│  componentDidMount → store.getDailyRecord() → DayView       │
└─────────────────────────────────────────────────────────────┘
```

---

## Architectural patterns

### Ports and adapters at the two browser edges
The extension touches four browser globals: `performance`, `chrome.runtime`,
`chrome.storage.local` and the clock. Each sits behind an interface with a real
second implementation in `test/fakes/`, which is what makes the second one worth
having — one adapter would only be a hypothetical seam.

| Port | Production adapter | Test adapter |
| --- | --- | --- |
| `PerformanceSource` | `BrowserPerformanceSource` | scripted entries, in the tests |
| `ObservationSink` | `RuntimeObservationSink` | recording sink, in the tests |
| `DailyRecordsStorage` | `ChromeStorage` | `InMemoryDailyRecordsStorage` |
| `Clock` | `SystemClock` | `FixedClock` |

Nothing reaches for an ambient singleton: the clock and the storage are
constructor arguments, so a test constructs its own world and no module has to
publish a reset hook for the test run.

### Discriminated results instead of nullable returns
`measurePage()` and `parseDomain()` both return `{ valid: true, … } | { valid: false }`,
and `getDailyRecord()` returns the neutral record rather than `null`. The compiler
forces the invalid branch to be handled, and no reader carries a `?? empty` fallback.

### One command per decision
`recordTabMetrics(tab)` replaced `hasExistingTabById()` + `addTab()` +
`updateTabMetrics()`. The three-call version let the caller decide add-or-update
*outside* the write queue that exists to serialise exactly that decision — two
messages for one tab could both conclude "not there yet" and append twice.
The upsert now happens inside the queue, so the sequence cannot be got wrong.

### Interface segregation on the store
`MetricsStore` is the intersection of three roles, and each caller takes only its own:

| Role | Methods | Taken by |
| --- | --- | --- |
| `DailyRecordReader` | `getDailyRecord`, `getAllDays` | the panel |
| `TabMetricsRecorder` | `recordTabMetrics` | `MetricsIntake` |
| `RetentionEnforcer` | `clearPastDays` | the reset alarm |

The intake cannot drop a day; the panel cannot write a measurement.

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
`createMetricsStore(storage, clock)` returns a store that owns today's `DailyRecord`.
Repeated reads while the panel is open hit an in-memory cache; a write **warms** it
with the value just persisted rather than invalidating it, saving a storage
round-trip. `clearPastDays` drops it, since it can remove days wholesale.

Each browser context builds its own store — the background and the panel are
separate JavaScript realms and cannot share a cache.

### Security — RateLimiter
`RateLimiter` (`src/security/RateLimiter.ts`) protects all side-effecting UI actions (export, refresh, storage writes) from abuse. Each action has its own counter, scoped by string key.

- **Window**: 60 seconds, 10 calls max
- **Throttle**: quadratic on excess — delay grows as `excess² × 1s` (1s, 4s, 9s…)
- **Usage**: one `RateLimiter` instance per UI context (popup, side panel), passed to action handlers

```typescript
const limiter = new RateLimiter(clock);
if (!limiter.isAllowed("csv-export")) return;
```

The `Clock` is a constructor argument, so the throttle can be tested by advancing
a `FixedClock` instead of waiting sixty seconds.

`page_metrics` messages from the content script are **not** rate-limited — every page load is a valid data point.

### Background / Popup / Content separation
- The **Background script** (service worker on Chromium, event page on Gecko) wakes on demand → guards the incoming message, resolves the tab, hands it to `MetricsIntake`, and owns the alarms
- The **Panel** mounts/unmounts on every open → holds a `DailyRecordReader`, so it reads measurements and writes only preferences
- The **Content script** is injected on every page → builds a `MetricsCollector` over the real browser globals and fires it once the load event has passed

---

## Cross-browser build

One codebase, one manifest per browser engine. `dist/manifest.json` is **generated** at build time — there is no checked-in `manifest.json`.

| File | Role |
|---|---|
| `scripts/manifest.mjs` | Shared manifest base + one builder per target (`chrome`, `firefox`) |
| `scripts/build.mjs` | Runs the three Vite builds, then writes `dist/manifest.json` for the target |
| `vite.config.ts` | Plugins only (React, Tailwind), used by `npm run dev` |

```
npm run build            → dist/ for Chromium (default)
npm run build:firefox    → dist/ for Gecko
npm run package:chrome   → carbolate-chrome.zip
npm run package:firefox  → carbolate-firefox.zip
npm run package:sources  → carbolate-sources.zip (required by AMO review)
```

The `chrome` target also covers Edge, Opera, Brave and Vivaldi — same MV3 runtime, same zip. Safari requires an extra `xcrun safari-web-extension-converter` pass over the `chrome` build.

### Permissions

```json
{
  "permissions": ["storage", "alarms", "downloads"],
  "host_permissions": ["<all_urls>"]
}
```

`downloads` backs the CSV export (`utils/csv.ts`). `sidePanel` is added on Chromium only — the permission does not exist in Gecko and triggers an AMO review warning. `tabs`, `scripting`, `declarativeNetRequest*` and `contextMenus` were removed: nothing in `src/` calls them.

### Manifest deltas

| Chromium | Gecko | Why |
|---|---|---|
| `background.service_worker` | `background.scripts` | Firefox MV3 uses a non-persistent event page, not a service worker |
| `side_panel.default_path` | `sidebar_action.default_panel` | `side_panel` does not exist in Gecko |
| permission `sidePanel` | *(dropped)* | Invalid permission in Gecko |
| — | `browser_specific_settings.gecko.id` | Mandatory to sign on AMO |

### Why background and content are iife bundles

`background.js` and `content.js` are each built alone in Vite library mode with `formats: ["iife"]`, so neither emits an `import`. Reasons, in order of severity:

- Firefox MV3 event pages are **classic scripts** — an ESM `import` kills the extension at startup.
- No browser supports ES modules in content scripts.
- A multi-entry Rollup build hoists code shared by the panel and the background into `assets/*.js`, which reintroduces the `import` even when each entry looks self-contained.

Only the panel (`side_panel.js`, loaded from `index.html`) stays an ES module — extension pages support it everywhere.

### API compatibility

The `chrome.*` namespace is aliased in Firefox, callback style included, so `ChromeStorage` and the alarms/messaging calls work unchanged. Three places needed adjusting:

- `background/index.ts` — the page URL is read from `sender.url` (no permission needed) rather than `sender.tab.url`, which Firefox withholds until host access is granted.
- `background/index.ts` — reset alarm delay is clamped to 1 minute; Firefox silently reschedules anything shorter.
- `utils/csv.ts` — the blob URL is revoked in the `downloads.download` callback; Firefox invalidates it when the panel closes.
