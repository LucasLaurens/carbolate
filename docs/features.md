# Functional documentation

## What is Carbolate?

Carbolate is a browser extension — Chrome, Edge, Opera, Brave, Vivaldi and Firefox — that estimates the carbon footprint of your browsing in real time. It analyses two sources: **network traffic** (the bytes that actually crossed the network) and **page load duration** (a proxy for the energy your machine spent), then converts them into grams of CO₂ equivalent.

The perimeter is **usage only**: manufacturing of servers, network gear and your device is excluded, so the figure is a floor rather than a total. See [the carbon model](carbon-model.md).

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

| Indicator            | Source                           | Unit  |
| -------------------- | -------------------------------- | ----- |
| Estimated CO₂        | `totalCarbon.totalCo2`           | grams |
| Data transferred     | `totalMetrics.totalResourceSize` | MB    |
| HTTP requests        | `totalMetrics.requestCount`      | count |
| Tabs visited         | `record.tabs.length`             | count |
| Avoided by the cache | `totalCarbon.avoidedCo2`         | grams |

A doughnut chart displays the **5 most CO₂-intensive domains** for the day.

The CO₂ card is colour-coded by sobriety level and shows:

- an eco-equivalence (emails, streaming, car km, flight km)
- a coarse position against the daily reference

| Level     | Range         | Colour | Badge |
| --------- | ------------- | ------ | ----- |
| Sober     | < 60 gCO₂e    | green  | 🥇    |
| Moderate  | 60–180 gCO₂e  | yellow | 🥈    |
| Intensive | 180–480 gCO₂e | orange | 🥉    |
| Excessive | ≥ 480 gCO₂e   | red    | ⛔    |

Those bands are **not literals**: they are the daily reference of **120 gCO₂e**
(ADEME 2023 / Shift Project 2022) multiplied by `0.5 / 1.5 / 4`. The multipliers are
a design choice, not a source — no study says when browsing becomes excessive.

The comparison against that reference is stated as a **position** — _well below /
below / around / above / well above_ — and never as a percentage. Carbolate measures
usage only while the reference has a full perimeter, so the comparison carries a
structural 20–25 % bias that a rounded percentage would hide behind false precision.

### Avoided CO₂

When resources are served from cache, a separate line reports what that spared:
the uncompressed size of those resources priced at the network factor. It is a
positive, pedagogical figure and is **never** subtracted from the day's total —
otherwise a well-cached site could report a negative footprint. Shown only when the
cache actually spared something.

### Internationalization

The entire UI supports **English and French**. The active language is stored in `Preferences.language` and persisted in `chrome.storage.local`. Switching language is instant with no page reload.

### CSV export

- Generates a `carbolate-export-YYYY-MM-DD.csv` file downloaded via `chrome.downloads`
- Contains all historical data: one row per tracked tab
- Columns: `date, domain, url, requestCount, totalResourceSize_MB, pageLoadDuration_s, cachedPageWeight_MB, networkCo2_g, deviceCo2_g, totalCo2_g, avoidedCo2_g, visitTimestamp`
- Fields containing a comma or a quote are quoted and escaped, so the column count survives any url
- Reachable from the **Export CSV** button at the bottom of the day view, rate-limited under the `"csv-export"` key

> The previous header — `cpuTimeToLoad_s`, `cpuCo2_g`, `renderingCo2_g` — is
> **abandoned, not versioned**: the export had no control rendering it until this
> release, so no file in the wild depends on those columns.

### Manual refresh

A **Refresh** button sits beside the export, rate-limited under the `"refresh"` key.

It is not a convenience. The panel is a side panel on Chromium and a sidebar on
Gecko, so it stays mounted while you keep browsing and its figures go stale as soon
as the next page loads. In the toolbar popup it remounts on each open and the button
is redundant; in the two other surfaces it is the only way to see a new measurement.

### Automatic reset

- A Chrome alarm fires automatically at midnight
- Its period is **derived from `retentionDays`**, not configured separately: a one-day window (and "keep everything") is checked every 24h, a longer window once per window
- Deletes data older than the retention window; today is never dropped
- `retentionDays` is the single source of truth — `1`, `7`, `30`, `60` or `-1` all work with no new type

### Preferences view

Accessible via the "Settings" tab in the popup.

#### Language (implemented)

| Setting  | Values             | Default |
| -------- | ------------------ | ------- |
| Language | English / Français | English |

The entire popup UI switches language instantly on selection — no save button required.

#### How this number is built (implemented)

A collapsed disclosure under the language picker states, in the active language, why the
figure is an estimate and why it is a floor. Two distinct reasons, because they answer two
different objections:

| Reason             | Answers                | Text says                                                                                                                                                   |
| ------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Not measurable** | "your number is wrong" | The servers are not ours and a web page cannot read the machine's power draw, so what can be seen — bytes, load time — is multiplied by published averages. |
| **Usage only**     | "your number is low"   | Making the servers, the network hardware and the device is excluded, so the real figure is about a quarter higher.                                          |

It is a native `<details>` element, collapsed by default: one line in a 320 px panel, and no
state to hold. Before it existed, the perimeter lived only in `docs/` — the UI said
"Estimated CO₂" and nothing more, which says _approximate_ without ever saying
_systematically below_.

#### Other preferences (type exists, UI not yet implemented)

The `Preferences` type supports `retentionDays` and `autoExportBeforeReset` but no UI is exposed for these yet:

| Setting                  | Values                                                       | Default |
| ------------------------ | ------------------------------------------------------------ | ------- |
| Retention                | `1` = today only, `7` = rolling week, `-1` = keep everything | `1`     |
| Auto-export before reset | Yes / No                                                     | No      |

`ResetPeriod` (`"daily" | "weekly"`) has been **removed**: it duplicated
`retentionDays` and allowed the incoherent pair `weekly` + `retentionDays: 1`.

---

## User flows

### Page load (automatic collection)

```
User navigates to a new URL
  → Content script builds a MetricsCollector and fires it once the load event has passed
  → BrowserPerformanceSource reads the Performance API
      getEntriesByType("resource")   → [{ transferSize, decodedBodySize }]
      getEntriesByType("navigation") → [{ duration }]
    (projected onto plain objects — the entries themselves are not serializable)
  → RuntimeObservationSink sends { type: "page_metrics", payload }
    → Background guards the message shape with isPageMetricsMessage()
    → tabId + url resolved from sender
    → MetricsIntake.record({ tabId, url, payload })
        → parseDomain(url)      — discard if not http(s)
        → measurePage(payload)  — discard if no resource entry
        → Metrics { requestCount, totalResourceSize (MB), pageLoadDurationSec (s), cachedPageWeight (MB) }
        → toCarbonInput + CarbonCalculator → CarbonEstimate { networkCo2, deviceCo2, totalCo2, avoidedCo2 }
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
      (normalised through session/legacy.ts, so a day written by an older
       version carries today's shape; the neutral record if nothing was
       measured today — never null)
    → setState({ record })
  → DayView displayed with today's data
```

### Manual export

```
User clicks "Export CSV"
  → Popup.handleExport()
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
Midnight (or end of window for a longer retention)
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
- Changing the retention window only takes effect on next browser restart — the alarm is rescheduled on install and on startup, not on preference change
- Tabs open across an extension update keep running the previous content script until reloaded; their reports carry no `decodedBodySize`, so those visits report no avoided CO₂ (the rest of the measurement is unaffected)
- On Firefox the panel is a sidebar (`sidebar_action`), on Chromium a side panel — same UI, different browser chrome
- Safari is not published: it needs an extra `xcrun safari-web-extension-converter` pass and an Apple developer account
