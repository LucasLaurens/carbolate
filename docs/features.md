# Functional documentation

## What is Carbolate?

Carbolate is a browser extension — Chrome, Edge, Opera, Brave, Vivaldi and Firefox — that estimates the carbon footprint of your browsing in real time. It analyses three sources: **network traffic** (the bytes that actually crossed the network), **page load duration** (a proxy for the energy your machine spent) and **time the page was visible** (the screen's share), then converts them into grams of CO₂ equivalent.

The perimeter is **usage only**: manufacturing of servers, network gear and your device is excluded, so the figure is a floor rather than a total. See [the carbon model](carbon-model.md).

---

## Features

### Automatic collection

- A page is measured **for as long as it lives**, not once at its load event: a `PerformanceObserver` folds each resource as it arrives, so requests fired after the load — lazy images, XHR, a video playing — are counted too
- Time is counted only while the page is **visible**. A tab loaded in the background and never looked at is charged its network and its CPU, and no screen at all
- Totals are reported every **5 seconds**, and at each edge: load, tab hidden, tab closed. Each report carries the visit's cumulative totals, so a lost message is caught by the next and a repeated one changes nothing
- A report is filed under the day its visit **began**. A page open across midnight keeps adding to yesterday; if retention has already dropped that day, the report is discarded rather than resurrecting it
- Non-collectable URLs (`chrome://`, `about:blank`, `file://`) are silently ignored, and so is a page that reported no resource at all
- The panel **follows storage as it changes** — no refresh button, and no stale figure while it stays open

### Current day dashboard

The main view displays 4 indicators for the current day:

| Indicator            | Source                           | Unit  |
| -------------------- | -------------------------------- | ----- |
| Estimated CO₂        | `totalCarbon.totalCo2`           | grams |
| Data transferred     | `totalMetrics.totalResourceSize` | MB    |
| HTTP requests        | `totalMetrics.requestCount`      | count |
| Page loads           | `record.visits.length`           | count |
| Avoided by the cache | `totalCarbon.avoidedCo2`         | grams |

A doughnut chart displays the **5 most CO₂-intensive domains** for the day.

### Last seven days

Under the doughnut, seven bars — one per day, oldest first, today outlined — each carrying its
total in grams above it and its short weekday name below. Bar colour is the **daily** sobriety
grade; there is no vertical axis, and no grade on the week itself.

- A day with **no measurement draws no bar**; its label is greyed. A zero-height bar would
  claim a sober day that was never recorded.
- The window is always seven days, whatever `retentionDays` is worth — thirty bars would be 8px
  wide in a 320px panel.
- The whole section is **absent** while storage holds a single day, so there is no empty state
  to read.

The CO₂ card is colour-coded by sobriety level and carries a permanent line saying what the
figure is — "Running total — resets at midnight" — because it now grows while the panel is open.
Without it, a user who reopens the panel and finds a higher number reads a bug. It also shows:

- an eco-equivalence (emails, streaming, car km, flight km)
- a coarse position against the daily reference

| Level     | Range         | Colour | Medal | Badge hex |
| --------- | ------------- | ------ | ----- | --------- |
| Sober     | < 60 gCO₂e    | green  | 🥇    | `#15803d` |
| Moderate  | 60–180 gCO₂e  | yellow | 🥈    | `#a16207` |
| Intensive | 180–480 gCO₂e | orange | 🥉    | `#c2410c` |
| Excessive | ≥ 480 gCO₂e   | red    | ⛔    | `#b91c1c` |

## Toolbar badge

The extension icon carries the day's own grade, panel closed:

| Day's total | Badge  | Background      |
| ----------- | ------ | --------------- |
| `0`         | `–`    | grey `#6b7280`  |
| under 1 g   | `<1`   | sobriety colour |
| under 1 kg  | `133`  | sobriety colour |
| under 10 kg | `1.2k` | sobriety colour |
| beyond      | `12k`  | sobriety colour |

Four characters is all a badge holds, so the unit and the level in words live in the
tooltip: `Carbolate — 133 g aujourd'hui · Modéré`. That tooltip is also the only
channel a screen reader reaches — neither the colour nor the digits are exposed to it.

A day with nothing measured shows a grey `–`, never a green `0`: grading an absence
of data would be a verdict on nothing. The badge always grades **today**, whatever
history the panel displays — the thresholds derive from a daily anchor.

The badge is rewritten after every measure, at startup, after the daily reset, and on
a language change. See [ADR](decisions/2026-08-21-badge-icone.md).

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
- Columns: `date, domain, url, requestCount, totalResourceSize_MB, pageLoadDuration_s, cachedPageWeight_MB, networkCo2_g, deviceCo2_g, screenCo2_g, totalCo2_g, avoidedCo2_g, visitTimestamp`
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
- The window is counted in whole local days: `7` keeps seven days, today included. The cutoff rule has one home, `isKept` in `src/config/retention.ts`
- A cycle that would drop nothing does nothing — it does not export either, so widening the window never produces a CSV nobody asked for
- A change to `retentionDays` reschedules the alarm at once through `chrome.storage.onChanged`; no browser restart

### Privacy view

A third tab, "Privacy" / "Vie privée", holds the extension's privacy policy in the active
language — ten sections, each a collapsed `<details>`: what is recorded, what is never read or
sent, why each permission is asked for, how long data is kept, how to erase it, what the CSV
export means, children, changes, contact.

It exists because Chrome requires the data disclosure to appear **in the extension's UI**; a
policy reachable only through the store listing does not satisfy the requirement. The panel's
footer carries `lucas.laurens@proton.me` in fine print on every tab, so the contact is one
glance away from wherever a user happens to be.

The wording lives in `src/legal/privacy.ts` and nowhere else. `docs/privacy/index.html` is the
same policy in long form, and `src/legal/privacy.test.ts` fails if the two drift apart.

**Published** at <https://lucaslaurens.github.io/carbolate/privacy/> — the link both store
dashboards ask for, since the _Privacy policy_ field takes a URL, not text. It is served by
GitHub Pages from the public `lucaslaurens.github.io` repository; the Carbolate repository stays
private. The URL is quoted in two store listings, so changing it means editing both: publish
under the same path when the text changes.

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

#### History kept (implemented)

A row of three buttons under the language picker, same markup as the language row.

| Label             | `retentionDays` | Reset alarm fires        |
| ----------------- | --------------- | ------------------------ |
| 1 day / 1 jour    | `1`             | every 24h                |
| 7 days / 7 jours  | `7`             | every 7 days             |
| Everything / Tout | `-1`            | every 24h, drops nothing |

`30` stays representable with no new type, but is not offered until the monthly comparison
needs it. The list has one home — `RETENTION_OPTIONS` in `src/config/retention.ts` — and the
translations are keyed by the window itself, so an option cannot ship without its two labels.

**Shrinking the window deletes days, immediately.** It is the only action in the product that
destroys recorded data, so it is the only one that asks first: a native confirmation naming the
exact number of days about to go. Cancelling changes nothing — not even the selected button,
because the control reads the stored preference rather than a local copy. Widening asks nothing
and deletes nothing.

The panel cannot delete a day: its store is read-only on measurements. It writes the preference,
and the background — which owns the alarm and the reset cycle — reacts to the storage change by
rescheduling the alarm and running the cycle. Without that listener the new window would only
take effect at the next browser start.

#### Export before deleting (implemented)

An checkbox under the retention row, off by default.

| Setting                | Values   | Default |
| ---------------------- | -------- | ------- |
| Export before deleting | Yes / No | No      |

When it is on, the shrink confirmation says the days will be exported then removed, rather than
deleted for good — the days leave the extension, not the disk.

**Auto-export before reset.** When on, the reset alarm exports every stored day as CSV — the
same file the panel's export button produces — before the retention window drops anything. The
export runs first and a failure **aborts the deletion**: the days stay, and the next alarm tick
retries. A reset that wiped days after a refused download would lose them with nothing to show
for it.

The download is issued from the background, where the panel's blob URL is unavailable on
Chromium (MV3 service workers have no `URL.createObjectURL`), so the CSV travels as a data URL
there and as a blob on Firefox's event page — see `buildCsvUrl` in `src/utils/csv.ts`.

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
        → toCarbonInput + CarbonCalculator → CarbonEstimate { networkCo2, deviceCo2, screenCo2, totalCo2, avoidedCo2 }
        → store.recordPageVisit(visit) — append, or replace the same (tabId, timeOrigin, url)
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
