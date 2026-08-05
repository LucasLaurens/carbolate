# Functional documentation

## What is Carbolate?

Carbolate is a browser extension — Chrome, Edge, Opera, Brave, Vivaldi and Firefox — that estimates the carbon footprint of your browsing in real time. It analyzes two sources: **network traffic** (downloaded data) and **CPU time** (page processing load), then converts them into grams of CO₂ equivalent.

---

## Features

### Automatic collection
- On every new page load, metrics are collected **automatically** by the content script and sent to the background
- If the tab has already been tracked during the day, its measurements and collection timestamp are replaced; the domain recorded stays that of the tab's first load
- Concurrent reports for the same tab — a reload storm, for instance — produce a single entry, not one per report
- Non-collectable URLs (`chrome://`, `about:blank`, `file://`) are silently ignored, and so is a page that reported no resource at all
- The panel re-reads storage when it opens

### Current day dashboard
The main view displays 4 indicators for the current day:

| Indicator | Source | Unit |
|---|---|---|
| Estimated CO₂ | `totalCarbon.totalCo2` | grams |
| Data transferred | `totalMetrics.totalResourceSize` | MB |
| HTTP requests | `totalMetrics.requestCount` | count |
| Tabs visited | `record.tabs.length` | count |

A doughnut chart displays the **5 most CO₂-intensive domains** for the day.

Each stat card is color-coded by carbon level and shows:
- an eco-equivalence (emails, streaming, car km, flight km)
- a daily score vs. world average (e.g. `−73% vs. world avg`)

| Level | Range | Color | Badge |
|---|---|---|---|
| Sober | < 50 gCO₂e | green | 🥇 |
| Moderate | 50–250 gCO₂e | yellow | 🥈 |
| Intensive | 250–600 gCO₂e | orange | 🥉 |
| Excessive | ≥ 600 gCO₂e | red | ⛔ |

World average reference: **120 gCO₂e/day** for web browsing (ADEME 2023).

### Internationalization
The entire UI supports **English and French**. The active language is stored in `Preferences.language` and persisted in `chrome.storage.local`. Switching language is instant with no page reload.

### CSV export
- Generates a `carbolate-export-YYYY-MM-DD.csv` file downloaded via `chrome.downloads`
- Contains all historical data: one row per tracked tab
- Columns: `date, domain, url, requestCount, totalResourceSize_MB, cpuTimeToLoad_s, networkCo2_g, cpuCo2_g, renderingCo2_g, totalCo2_g, visitTimestamp`
- Fields containing a comma or a quote are quoted and escaped, so the column count survives any url

> **Not reachable from the UI yet.** `Popup.handleExport` exists and is rate-limited,
> but no control renders it. Same for refresh: `Popup.handleRefresh` runs on mount,
> and `DayView` receives an `onRefresh` prop it does not render a button for. The
> handlers are wired; the two controls are not.

### Automatic reset
- A Chrome alarm fires automatically at midnight
- The alarm period depends on the configured mode: **24h** (daily) or **7 days** (weekly)
- Deletes data older than the configured retention period
- Configured from the Preferences view

### Preferences view
Accessible via the "Settings" tab in the popup.

#### Language (implemented)

| Setting | Values | Default |
|---|---|---|
| Language | English / Français | English |

The entire popup UI switches language instantly on selection — no save button required.

#### Other preferences (type exists, UI not yet implemented)

The `Preferences` type supports `resetPeriod` and `autoExportBeforeReset` but no UI is exposed for these yet:

| Setting | Values | Default |
|---|---|---|
| Reset period | Daily / Weekly | Daily |
| Auto-export before reset | Yes / No | No |

**Daily**: alarm every 24h — `retentionDays = 1` → only today's data is retained.
**Weekly**: alarm every 7 days — `retentionDays = 7` → the last 7 days are retained.

---

## User flows

### Page load (automatic collection)
```
User navigates to a new URL
  → Content script builds a MetricsCollector and fires it once the load event has passed
  → BrowserPerformanceSource reads the Performance API
      getEntriesByType("resource")   → [{ transferSize }]
      getEntriesByType("navigation") → [{ duration }]
    (projected onto plain objects — the entries themselves are not serializable)
  → RuntimeObservationSink sends { type: "page_metrics", payload }
    → Background guards the message shape with isPageMetricsMessage()
    → tabId + url resolved from sender
    → MetricsIntake.record({ tabId, url, payload })
        → parseDomain(url)      — discard if not http(s)
        → measurePage(payload)  — discard if no resource entry
        → Metrics { requestCount, totalResourceSize (MB), cpuTimeToLoad (s) }
        → toCarbonInput + CarbonCalculator → CarbonEstimate
        → store.recordTabMetrics(tab) — upsert inside the write queue
    → Data persisted in ChromeStorage
```

### Panel opened
```
User clicks the Carbolate icon
  → App.tsx builds the clock and the store, passes them to Popup as props
  → Popup mounted (componentDidMount)
  → Preferences loaded from PreferencesStorage.getPreferences()
  → handleRefresh()
    → store.getDailyRecord() → reads ChromeStorage
      (the neutral record if nothing was measured today — never null)
    → setState({ record })
  → DayView displayed with today's data
```

### Manual export (handler only — no control rendered)
```
Popup.handleExport()
  → rate limiter check ("csv-export")
  → store.getAllDays() → retrieves the full history
  → toCSV(records) → escaped CSV text
  → chrome.downloads.download() → browser download
```

### Language change
```
User clicks "Settings"
  → Clicks "English" or "Français"
    → language = "en" | "fr"
    → ChromeStorage.setPreferences(prefs) (immediate, no save button)
    → Popup re-renders with new translations
    → "Saved" feedback shown for 1.5s
```

### Nightly reset (automatic)
```
Midnight (or end of week in weekly mode)
  → chrome.alarms fires "reset"
  → Reads ChromeStorage.getPreferences()
  → If retentionDays = 1: deletes everything except today
  → If retentionDays = 7: deletes data older than 7 days
  → If retentionDays = -1: deletes nothing
  → Cutoff computed in local time (not UTC)
```

---

## Known limitations

- Collection only works on standard web pages — `chrome://`, `file://`, `about:blank` do not trigger the content script
- Pages already open before the extension was installed will not have their content script injected — they must be reloaded
- The CO₂ calculation is an **estimate** based on industry averages, not an exact measurement
- Changing the reset period (daily ↔ weekly) only takes effect on next browser restart
- On Firefox the panel is a sidebar (`sidebar_action`), on Chromium a side panel — same UI, different browser chrome
- Safari is not published: it needs an extra `xcrun safari-web-extension-converter` pass and an Apple developer account
