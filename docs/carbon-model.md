# CO₂ Calculation Model

## General principle

Carbolate estimates the carbon footprint of a web visit from two components:
1. **Network emissions**: related to transferred data (downloaded bytes)
2. **CPU emissions**: related to page processing time

The result is expressed in **grams of CO₂ equivalent (gCO₂e)**, rounded to the nearest integer.

---

## Calibration constants

Defined in `src/carbon/constants.ts`:

| Constant | Value | Description |
|---|---|---|
| `CARBON_PER_GB` | `442` gCO₂e/GB | Carbon intensity of the network per transferred gigabyte |
| `NETWORK_RATIO` | `0.75` | Network share vs. user device (75% network, 25% device) |
| `CPU_FACTOR` | `0.012` gCO₂e/s | Carbon intensity per second of active CPU |

> These values come from industry averages (IEA, Shift Project studies). They represent a reasonable estimate for a global average energy mix.

---

## OCP Architecture — CarbonContributionSource

The calculation is decomposed into **independent sources** via the `CarbonContributionSource` interface:

```typescript
// src/carbon/contracts/CarbonContributionSource.ts
interface CarbonContributionSource {
  metric: ContributionMetric;              // "networkCo2" | "cpuCo2"
  calculate(inputs: CarbonInput[]): number; // returns gCO₂e
}
```

`CarbonCalculator` accepts an array of sources in its constructor. By default:

```typescript
new CarbonCalculator([new NetworkCarbonSource(), new CpuCarbonSource()])
```

To add a new emission source (GPU, audio streaming, etc.), simply create a class implementing `CarbonContributionSource` and inject it — without modifying `CarbonCalculator`.

---

## Formulas

Each source implements its own formula:

**NetworkCarbonSource** (`src/carbon/sources/NetworkCarbonSource.ts`):
```
totalGB    = Σ(transferSize) / 1_000_000_000   [bytes → GB]
networkCo2 = totalGB × CARBON_PER_GB × NETWORK_RATIO
```

**CpuCarbonSource** (`src/carbon/sources/CpuCarbonSource.ts`):
```
totalSec = Σ(cpuTime) / 1000   [ms → seconds]
cpuCo2   = totalSec × CPU_FACTOR
```

**CarbonCalculator** aggregates:
```
totalCo2 = round(networkCo2) + round(cpuCo2)
```

### Concrete example

For a tab loading **2 MB** of resources with **1.5s** of CPU:

```
totalGB    = 2_000_000 / 1_000_000_000 = 0.002 GB
totalSec   = 1500 / 1000 = 1.5 s

networkCo2 = 0.002 × 442 × 0.75 = 0.663 → 1g
cpuCo2     = 1.5   × 0.012       = 0.018 → 0g

totalCo2   = 1g
```

---

## Input data sources

Data comes from the browser's native `Performance` API, collected by the content script and processed by the background via `NetworkMetricsExtractor`:

| CarbonInput field | Performance API source | Unit |
|---|---|---|
| `transferSize` | `PerformanceResourceTiming.transferSize` | bytes |
| `cpuTime` | `PerformanceNavigationTiming.duration` | ms |

`transferSize` represents the **compressed** size actually transferred over the network (0 if cached). `duration` is the total navigation time (DOMContentLoaded + sub-resources).

> **Note**: `PageMetricsValidator` specifically validates that `resource` entries exist (not just `navigation`), because only `resource` entries are used downstream by `NetworkMetricsExtractor`.

---

## Conversion in the store

Before passing to the calculator, metrics are converted from their internal storage format (in `src/session/store.ts`):

```typescript
const carbonMetricsCallback = (m: Metrics): CarbonInput => ({
  transferSize: m.totalResourceSize * 1024 * 1024, // MiB → bytes
  cpuTime:      m.cpuTimeToLoad * 1000,            // s → ms
});
```

> Note: `totalResourceSize` is stored in MB (mebibytes, 1024²) in `Metrics` but the formula uses decimal GB (1000³). This slight imprecision (~7%) is negligible for an order-of-magnitude estimate.

---

## Aggregation per tab and per day

```typescript
// src/session/aggregator.ts
sumMetrics(tabs)         → { requestCount, totalResourceSize, cpuTimeToLoad }
sumCarbonEstimates(tabs) → { networkCo2, cpuCo2, totalCo2 }
```

Each `MetricTab` has its own `carbon`. The `DailyRecord.totalCarbon` is the **sum** of the carbon values of all tabs for the day. This means visiting the same domain multiple times **accumulates** emissions.
