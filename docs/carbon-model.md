# CO₂ Calculation Model

## General principle

Carbolate estimates the carbon footprint of a web visit from two components:

1. **Network CO₂** — transmission networks and data centres, from the bytes that crossed the network
2. **Device CO₂** — the user's machine while the page loads

Alongside them it reports one figure that is **not** part of the footprint:

3. **Avoided CO₂** — what the cache spared, never subtracted from the total

The result is expressed in **grams of CO₂ equivalent (gCO₂e)**.

## Perimeter — usage only

The model counts energy consumed **while browsing**. It excludes the manufacturing
of servers, network gear and the user's device. The figure it produces is therefore
a **floor**, not a total: roughly 20–25 % below a full-perimeter model such as
Sustainable Web Design.

Every factor below carries either a published source or the explicit label
_house estimate_. See [the perimeter ADR](decisions/2026-08-05-perimetre-modele-carbone.md).

---

## Calibration constants

Defined in `src/carbon/constants.ts`:

| Constant                         | Value                 | Description                                              | Source                          |
| -------------------------------- | --------------------- | -------------------------------------------------------- | ------------------------------- |
| `GRID_INTENSITY_G_CO2_PER_KWH`   | `442` gCO₂e/kWh       | Global average grid carbon intensity                     | IEA 2023                        |
| `NETWORK_ENERGY_KWH_PER_GB`      | `0.4` kWh/GB          | Energy per GB for data centres + transmission            | IEA 2023 / ADEME 2023           |
| `CARBON_PER_GB`                  | `176.8` gCO₂e/GB      | `NETWORK_ENERGY × GRID_INTENSITY`                        | derived                         |
| `DEVICE_FACTOR`                  | `0.00098` gCO₂e/s     | CPU + GPU per second of page load (8.0 W)                | **house estimate**              |
| `SCREEN_FACTOR`                  | `0.00042` gCO₂e/s     | Screen per second lit (3.4 W panel draw)                 | Fraunhofer/DOE parc average     |
| `DAILY_BROWSING_REFERENCE_G_CO2` | `120` gCO₂e           | Average daily web-browsing footprint of an internet user | ADEME 2023 / Shift Project 2022 |
| `SOBRIETY_MULTIPLIERS`           | `0.5 / 1.5 / 4`       | Applied to the reference → the sobriety thresholds       | **design choice, not a source** |
| `WORLD_COMPARISON_MULTIPLIERS`   | `0.5 / 0.9 / 1.1 / 2` | Band edges of the world comparison                       | **design choice, not a source** |

> **Methodology note**: `NETWORK_ENERGY_KWH_PER_GB = 0.4` is updated from the 2019
> Shift Project estimate of 0.75 kWh/GB, reflecting efficiency gains in data centres
> and fixed-broadband networks documented by IEA 2022–2023.

> **Why `DEVICE_FACTOR` is one number.** It replaces a `CPU_FACTOR` (0.001) and
> `RENDERING_FACTOR` (0.0004) pair that multiplied the **same** value — the
> navigation duration — by two coefficients. That was never two measurements; it
> was one measurement with a factor cut in half, and the cut implied a precision the
> input cannot carry.

> **Why the screen is split out, and only the screen.** `DEVICE_FACTOR + SCREEN_FACTOR`
> is exactly the `0.0014` that shipped before, so no stored day moves. The split is not
> a second measurement either — it is the one number for which a published source
> exists (3.4 W of panel), which makes the remaining 8.0 W nameable as the house
> estimate it always was. The screen's share is **attributional**: the panel was
> already on, browsing only uses a part of it, and closing the tab does not turn it
> off. See [ADR](decisions/2026-09-15-energie-ecran.md).

---

## OCP architecture — CarbonContributionSource

The calculation is decomposed into **independent sources**:

```typescript
// src/carbon/contracts/CarbonContributionSource.ts
interface CarbonContributionSource {
  readonly metric: ContributionMetric; // "networkCo2" | "deviceCo2" | "screenCo2"
  calculate(inputs: readonly CarbonInput[]): number; // returns gCO₂e
}
```

`CarbonCalculator` accepts an array of sources in its constructor. By default:

```typescript
new CarbonCalculator([
  new NetworkCarbonSource(),
  new DeviceCarbonSource(),
  new ScreenCarbonSource(),
]);
```

To add a new emission channel, create a class implementing
`CarbonContributionSource` and inject it — without modifying `CarbonCalculator`,
which sums `totalCo2` from whatever channels it was given.

`ContributionMetric` deliberately **excludes** `avoidedCo2`:

```typescript
type ContributionMetric = keyof Omit<CarbonEstimate, "totalCo2" | "avoidedCo2">;
```

so no source can write into the avoided figure and reach the total through it.
Avoided CO₂ is computed by a plain function, `src/carbon/avoidedCarbon.ts` — one
implementation, so no seam is built for it.

---

## Formulas

**NetworkCarbonSource** (`src/carbon/sources/NetworkCarbonSource.ts`):

```
totalGB    = Σ(transferredBytes) / 1_000_000_000   [bytes → GB, base 10]
networkCo2 = totalGB × CARBON_PER_GB               [176.8 gCO₂e/GB]
```

**DeviceCarbonSource** (`src/carbon/sources/DeviceCarbonSource.ts`):

```
totalSec  = Σ(pageLoadDurationMs) / 1000   [ms → seconds]
deviceCo2 = totalSec × DEVICE_FACTOR       [0.00098 gCO₂e/s]
```

**ScreenCarbonSource** (`src/carbon/sources/ScreenCarbonSource.ts`):

```
totalSec  = Σ(pageLoadDurationMs) / 1000   [the only lit time observed today]
screenCo2 = totalSec × SCREEN_FACTOR       [0.00042 gCO₂e/s]
```

Its input is the load duration until the living record ([#40]) makes the whole display
time reachable. Until then `screenCo2` is a floor: it charges the panel for the load and
for nothing after it.

**computeAvoidedCarbon** (`src/carbon/avoidedCarbon.ts`):

```
cachedGB   = Σ(cachedBytes) / 1_000_000_000
avoidedCo2 = cachedGB × CARBON_PER_GB      [the network transfer that did not happen]
```

**CarbonCalculator** aggregates:

```
totalCo2 = networkCo2 + deviceCo2 + screenCo2   [avoidedCo2 is NOT in here]
```

### Concrete example

A tab loading **2 MB** over the network with **1.5 s** of load time, plus **3 MB**
served from cache:

```
totalGB    = 2_000_000 / 1_000_000_000 = 0.002 GB
totalSec   = 1500 / 1000 = 1.5 s
cachedGB   = 3_000_000 / 1_000_000_000 = 0.003 GB

networkCo2 = 0.002 × 176.8 = 0.3536 g
deviceCo2  = 1.5   × 0.00098 = 0.00147 g
screenCo2  = 1.5   × 0.00042 = 0.00063 g
totalCo2   ≈ 0.356 g

avoidedCo2 = 0.003 × 176.8 = 0.5304 g   ← reported beside the total, never inside it
```

---

## Why the cache gets no factor of its own

A resource served from cache has `transferSize = 0`, so it emits no network CO₂.
The intuition that it is not free is correct, but its residual cost is **time** —
decoding, disk reads — which `deviceCo2` already charges through the load duration.
Adding a per-byte factor would count the same energy twice, and no published source
gives gCO₂e per byte read from a disk: it would have to be invented.

So the cache is credited, not charged. `avoidedCo2` is a positive, pedagogical
figure computed from `decodedBodySize` — data already present in
`PerformanceResourceTiming`.

---

## Input data sources

Data comes from the browser's native `Performance` API, collected by the content
script:

| `CarbonInput` field  | Performance API source                                                               | Unit  |
| -------------------- | ------------------------------------------------------------------------------------ | ----- |
| `transferredBytes`   | `PerformanceResourceTiming.transferSize`                                             | bytes |
| `pageLoadDurationMs` | `PerformanceNavigationTiming.duration`                                               | ms    |
| `cachedBytes`        | `PerformanceResourceTiming.decodedBodySize`, for entries whose `transferSize` is `0` | bytes |

`transferSize` is the **compressed** size actually transferred (0 if cached).
`duration` is **wall-clock** navigation time, used as a proxy for device activity —
it is not a CPU reading, which is why the field it feeds is named
`pageLoadDurationSec` and no longer `cpuTimeToLoad`.

`decodedBodySize` is absent from messages sent by a content script that has not
reloaded since an extension update. Its absence costs the avoided figure only; the
observation itself is still recorded.

---

## Eco-equivalences

Displayed in the panel's CO₂ card. Reference values (ADEME 2022–2023):

| Range          | Equivalence            | Factor                                             |
| -------------- | ---------------------- | -------------------------------------------------- |
| < 1 gCO₂e      | Emails (no attachment) | 0.3 gCO₂e/email                                    |
| 1–55 gCO₂e     | HD streaming minutes   | 55 gCO₂e/h (1080p, IEA 2022)                       |
| 55–550 gCO₂e   | HD streaming hours     | 55 gCO₂e/h                                         |
| 550–6000 gCO₂e | km by car              | 120 gCO₂e/km (avg. European gas car)               |
| ≥ 6000 gCO₂e   | km by plane            | 230 gCO₂e/km (short-haul, incl. radiative forcing) |

Each factor carries its own perimeter and they are **not additive**: this is a
comprehension aid, never a measurement.

---

## Sobriety levels

A **normative** grade on the day's total — "am I where I should be?", not "am I
average?". Computed by `src/carbon/sobriety.ts`.

The thresholds are **multiples of the single anchor**, never literals:

```
sober      < 0.5 × reference =  60 gCO₂e
moderate   < 1.5 × reference = 180 gCO₂e
intensive  < 4   × reference = 480 gCO₂e
excessive  ≥ 4   × reference
```

The multipliers are a **design choice, not a source**: no study says at what point
browsing becomes excessive. What is sourced is the anchor.

Changing `DAILY_BROWSING_REFERENCE_G_CO2` moves all four bands mechanically. That
is the point — one piece of knowledge, one home — and
`src/carbon/sobriety.test.ts` fails if a literal is written back into the level
table, which is the regression that removing them prevents.

`src/components/popup/DayView/utils.ts` maps a level to a colour and a badge. Only
the paint lives there; where the bands sit is a model decision.

---

## World comparison

A **coarse position** against the same anchor: _well below / below / around /
above / well above_. Computed by `src/carbon/worldComparison.ts`.

Deliberately **not a percentage**. The reference is a full-perimeter estimate
(device and network manufacturing amortised in) while Carbolate is usage-only, so
the comparison carries a structural 20–25 % bias in the flattering direction. A
figure like `−73 % vs. world average` would hide that behind a precision it does
not have; a coarse word survives it.

Both the levels and the comparison now derive from the same anchor, so they can no
longer contradict each other on screen — which is what "🥈 moderate" beside
"+25 % vs. world average" used to do.

---

## Aggregation per tab and per day

```typescript
// src/session/aggregator.ts
sumMetrics(entries)         → { requestCount, totalResourceSize, pageLoadDurationSec, cachedPageWeight }
sumCarbonEstimates(entries) → { networkCo2, deviceCo2, totalCo2, avoidedCo2 }
```

Each `PageVisit` carries its own `carbon`. `DailyRecord.totalCarbon` is the **sum**
across all visits for the day. `avoidedCo2` is summed like every other channel and
still stays out of `totalCo2`.

Every estimate reaching these functions has passed through
`src/session/legacy.ts`, so no field can be absent and no `?? 0` fallback is needed
downstream — see [Data schema and persistence](storage.md).
