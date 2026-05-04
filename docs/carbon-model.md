# CO₂ Calculation Model

## General principle

Carbolate estimates the carbon footprint of a web visit from three components:
1. **Network emissions**: related to transferred data (downloaded bytes)
2. **CPU emissions**: device energy during page processing time
3. **Rendering emissions**: GPU/display energy during active page render

The result is expressed in **grams of CO₂ equivalent (gCO₂e)**.

---

## Calibration constants

Defined in `src/carbon/constants.ts`:

| Constant | Value | Description | Source |
|---|---|---|---|
| `GRID_INTENSITY_G_CO2_PER_KWH` | `442` gCO₂e/kWh | Global average grid carbon intensity | IEA 2023 |
| `NETWORK_ENERGY_KWH_PER_GB` | `0.4` kWh/GB | Energy per GB for data centers + transmission | IEA 2023 / ADEME 2023 |
| `CARBON_PER_GB` | `176.8` gCO₂e/GB | `NETWORK_ENERGY × GRID_INTENSITY` | derived |
| `CPU_FACTOR` | `0.001` gCO₂e/s | Device energy per second of page load (15W laptop, 30% incremental load) | — |
| `RENDERING_FACTOR` | `0.0004` gCO₂e/s | GPU/display rendering energy per second of page load (~3W integrated GPU) | — |
| `WORLD_DAILY_BROWSING_G_CO2` | `120` gCO₂e | Global average daily web browsing footprint | ADEME 2023 / Shift Project 2022 |

> **Methodology note**: `NETWORK_ENERGY_KWH_PER_GB = 0.4` is updated from the 2019 Shift Project estimate of 0.75 kWh/GB, reflecting efficiency gains in data centers and fixed-broadband networks documented by IEA 2022–2023.

---

## OCP Architecture — CarbonContributionSource

The calculation is decomposed into **independent sources** via the `CarbonContributionSource` interface:

```typescript
// src/carbon/contracts/CarbonContributionSource.ts
interface CarbonContributionSource {
  metric: ContributionMetric;              // "networkCo2" | "cpuCo2" | "renderingCo2"
  calculate(inputs: CarbonInput[]): number; // returns gCO₂e
}
```

`CarbonCalculator` accepts an array of sources in its constructor. By default:

```typescript
new CarbonCalculator([
  new NetworkCarbonSource(),
  new CpuCarbonSource(),
  new RenderingCarbonSource(),
])
```

To add a new emission source, create a class implementing `CarbonContributionSource` and inject it — without modifying `CarbonCalculator`.

---

## Formulas

**NetworkCarbonSource** (`src/carbon/sources/NetworkCarbonSource.ts`):
```
totalGB    = Σ(transferSize) / 1_000_000_000   [bytes → GB]
networkCo2 = totalGB × CARBON_PER_GB           [176.8 gCO₂e/GB]
```

**CpuCarbonSource** (`src/carbon/sources/CpuCarbonSource.ts`):
```
totalSec = Σ(cpuTime) / 1000   [ms → seconds]
cpuCo2   = totalSec × CPU_FACTOR   [0.001 gCO₂e/s]
```

**RenderingCarbonSource** (`src/carbon/sources/RenderingCarbonSource.ts`):
```
totalSec    = Σ(cpuTime) / 1000         [ms → seconds; cpuTime = page load duration]
renderingCo2 = totalSec × RENDERING_FACTOR   [0.0004 gCO₂e/s]
```

**CarbonCalculator** aggregates:
```
totalCo2 = networkCo2 + cpuCo2 + renderingCo2
```

### Concrete example

For a tab loading **2 MB** of resources with **1.5s** of load time:

```
totalGB       = 2_000_000 / 1_000_000_000 = 0.002 GB
totalSec      = 1500 / 1000 = 1.5 s

networkCo2    = 0.002 × 176.8 = 0.354g
cpuCo2        = 1.5   × 0.001 = 0.0015g
renderingCo2  = 1.5   × 0.0004 = 0.0006g

totalCo2      ≈ 0.356g
```

---

## Input data sources

Data comes from the browser's native `Performance` API, collected by the content script:

| CarbonInput field | Performance API source | Unit |
|---|---|---|
| `transferSize` | `PerformanceResourceTiming.transferSize` | bytes |
| `cpuTime` | `PerformanceNavigationTiming.duration` | ms |

`transferSize` represents the **compressed** size actually transferred over the network (0 if cached). `duration` is the total navigation time used as a proxy for device active time.

---

## Eco-equivalences

Displayed in the popup CO₂ card. Reference values (ADEME 2022–2023):

| Range | Equivalence | Factor |
|---|---|---|
| < 1 gCO₂e | Emails (no attachment) | 0.3 gCO₂e/email |
| 1–55 gCO₂e | HD streaming minutes | 55 gCO₂e/h (1080p, IEA 2022) |
| 55–550 gCO₂e | HD streaming hours | 55 gCO₂e/h |
| 550–6000 gCO₂e | km by car | 120 gCO₂e/km (avg. European gas car) |
| ≥ 6000 gCO₂e | km by plane | 230 gCO₂e/km (short-haul, incl. radiative forcing) |

---

## World average comparison

The popup shows a daily score vs. global average:

- **World average**: 120 gCO₂e/day for web browsing (ADEME 2023 / Shift Project 2022)
- Format: `−73% vs. world avg` (below) or `+25% vs. world avg` (above)

---

## Aggregation per tab and per day

```typescript
// src/session/aggregator.ts
sumMetrics(tabs)         → { requestCount, totalResourceSize, cpuTimeToLoad }
sumCarbonEstimates(tabs) → { networkCo2, cpuCo2, renderingCo2, totalCo2 }
```

Each `MetricTab` has its own `carbon`. The `DailyRecord.totalCarbon` is the **sum** of the carbon values of all tabs for the day. Visiting the same domain multiple times **accumulates** emissions.
