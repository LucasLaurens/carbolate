# Functional documentation

## What is Carbolate?

Carbolate is a browser extension — Chrome, Edge, Opera, Brave, Vivaldi and Firefox — that estimates the carbon footprint of your browsing in real time. It analyzes two sources: **network traffic** (downloaded data) and **CPU time** (page processing load), then converts them into grams of CO₂ equivalent.

---

## Features

### Automatic collection
- On every new page load, metrics are collected **automatically** by the content script and sent to the background
- If the tab has already been tracked during the day, its metrics **and** metadata (date, status) are updated
- The "Refresh" button re-reads storage to display the most recent data
- Non-collectable URLs (`chrome://`, `about:blank`, `file://`) are silently ignored

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
- "Export CSV" button in the popup
- Generates a `carbolate-export-YYYY-MM-DD.csv` file downloaded via `chrome.downloads`
- Contains all historical data: one row per tracked tab
- Columns: `date, domain, url, requestCount, totalResourceSize_MB, cpuTimeToLoad_s, networkCo2_g, cpuCo2_g, totalCo2_g, visitTimestamp`

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
  → Content script triggered on window.load
  → performance.getEntriesByType("resource") → list of network resources
  → performance.getEntriesByType("navigation") → load timing
  → Converted to plain objects { transferSize }, { duration }
  → chrome.runtime.sendMessage({ type: "page_metrics", ... })
    → Background receives the message + sender.tab.{id, url}
    → EntriesValidator → validates that "resource" is not empty
    → ResourceStrategy → { resourceCount, totalTransferSize }
    → Metrics computed + carbon estimated
    → hasExistingTabById?
      ├─ No  → metricsStore.addTab(...)
      └─ Yes → metricsStore.updateTabMetrics(...)
    → Data persisted in ChromeStorage
```

### Popup opened
```
User clicks the Carbolate icon
  → Popup mounted (componentDidMount)
  → Preferences loaded from ChromeStorage.getPreferences()
  → handleRefresh() triggered automatically
    → metricsStore.findDailyRecord() → reads ChromeStorage
    → setState({ record })
  → DayView displayed with today's data
```

### Refresh button
```
User clicks "Refresh"
  → isLoading = true (button disabled)
  → metricsStore.findDailyRecord() → re-reads ChromeStorage
  → setState({ record })
  → isLoading = false
```

### Manual export
```
User clicks "Export CSV"
  → getAllDays() → retrieves the full history
  → CSV generated in memory
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
