import { describe, it, expect, beforeEach } from "vitest";
import { MetricsIntake } from "./MetricsIntake";
import type { PageObservation } from "./MetricsIntake";
import CarbonCalculator from "../carbon/CarbonCalculator";
import { toCarbonInput } from "../carbon/toCarbonInput";
import { createMetricsStore } from "../session/store";
import type { MetricsStore } from "../session/types";
import type { PageMeasurement, ResourceTiming } from "../performance/PageMetrics";
import { addResourceTiming, createEmptyMeasurement } from "../performance/PageMetrics";
import { InMemoryDailyRecordsStorage } from "../../test/fakes/InMemoryDailyRecordsStorage";
import { FixedClock } from "../../test/fakes/FixedClock";

const measure = (
  resources: ResourceTiming[],
  loadDurationMs: number,
  visibleDurationMs: number,
): PageMeasurement => ({
  ...resources.reduce(addResourceTiming, createEmptyMeasurement()),
  loadDurationMs,
  visibleDurationMs,
});

const observation = (
  overrides: Partial<PageObservation> & {
    resource?: ResourceTiming[];
    loadDurationMs?: number;
    visibleDurationMs?: number;
  } = {},
): PageObservation => ({
  tabId: overrides.tabId ?? 7,
  url: overrides.url ?? "https://blog.example.com/article",
  timeOrigin: overrides.timeOrigin ?? new Date("2026-02-23T11:00:00").getTime(),
  observedFrom: overrides.observedFrom ?? new Date("2026-02-23T11:00:01").getTime(),
  measurement:
    overrides.measurement ??
    measure(
      overrides.resource ?? [{ transferSize: 1_500_000, thirdParty: false }],
      overrides.loadDurationMs ?? 2_400,
      overrides.visibleDurationMs ?? 12_000,
    ),
});

let storage: InMemoryDailyRecordsStorage;
let store: MetricsStore;
let intake: MetricsIntake;
let clock: FixedClock;

beforeEach(() => {
  storage = new InMemoryDailyRecordsStorage();
  clock = new FixedClock("2026-02-23");
  store = createMetricsStore(storage, clock);
  intake = new MetricsIntake(store, new CarbonCalculator());
});

describe("MetricsIntake — what reaches the daily record", () => {
  it("records the visited page under its own domain", async () => {
    // Act
    await intake.record(observation({ url: "https://shop.example.com/products?q=1" }));

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
    expect(record.visits[0].domain).toBe("shop.example.com");
    expect(record.visits[0].url).toBe("https://shop.example.com/products?q=1");
  });

  it("stores transferred data in megabytes and load duration in seconds", async () => {
    // Act
    await intake.record(
      observation({
        resource: [{ transferSize: 1_500_000, thirdParty: false }],
        loadDurationMs: 2_400,
      }),
    );

    // Assert — base 10: 1 500 000 bytes = 1.5 MB, 2 400 ms = 2.4 s
    const [visit] = (await store.getDailyRecord()).visits;
    expect(visit.metrics.totalResourceSize).toBeCloseTo(1.5, 10);
    expect(visit.metrics.pageLoadDurationSec).toBeCloseTo(2.4, 10);
  });

  it("stores what the cache served, and credits it without touching the total", async () => {
    // Act — one resource off the network, one served from cache
    await intake.record(
      observation({
        resource: [
          { transferSize: 1_000_000, decodedBodySize: 1_000_000, thirdParty: false },
          { transferSize: 0, decodedBodySize: 2_000_000, thirdParty: false },
        ],
      }),
    );

    // Assert
    const [visit] = (await store.getDailyRecord()).visits;
    expect(visit.metrics.cachedPageWeight).toBeCloseTo(2, 10);
    expect(visit.carbon.avoidedCo2).toBeGreaterThan(0);
    expect(visit.carbon.totalCo2).toBeCloseTo(
      visit.carbon.networkCo2 + visit.carbon.deviceCo2 + visit.carbon.screenCo2,
      10,
    );
  });

  it("credits nothing when a stale content script sends no decoded size", async () => {
    // Arrange — the projection shipped before avoided CO₂ existed, still running
    // in a tab that has not reloaded since the update
    // Act
    await intake.record(observation({ resource: [{ transferSize: 0, thirdParty: false }] }));

    // Assert — the observation survives; only the avoided figure is lost
    const [visit] = (await store.getDailyRecord()).visits;
    expect(visit.metrics.requestCount).toBe(1);
    expect(visit.metrics.cachedPageWeight).toBe(0);
    expect(visit.carbon.avoidedCo2).toBe(0);
  });

  it("counts one request per resource entry", async () => {
    // Act
    await intake.record(
      observation({
        resource: [
          { transferSize: 10, thirdParty: false },
          { transferSize: 20, thirdParty: false },
          { transferSize: 0, thirdParty: false },
        ],
      }),
    );

    // Assert
    const [visit] = (await store.getDailyRecord()).visits;
    expect(visit.metrics.requestCount).toBe(3);
  });

  it("stamps the visit with the document's start, not with the arrival hour", async () => {
    // Arrange — a document that started well before the message reached us
    const startedAt = clock.nowMs() - 90_000;

    // Act
    await intake.record(observation({ timeOrigin: startedAt }));

    // Assert — every delta of one visit must carry the same identity to route onto it
    const [visit] = (await store.getDailyRecord()).visits;
    expect(visit.meta.date).toBe(startedAt);
  });

  it("keeps the stored carbon reproducible from the stored metrics", async () => {
    // Arrange
    const calculator = new CarbonCalculator();

    // Act
    await intake.record(observation());

    // Assert — the invariant the megabyte round-trip exists to protect: costing
    // the raw bytes instead of the stored value would drift from this.
    const [visit] = (await store.getDailyRecord()).visits;
    expect(visit.carbon).toEqual(calculator.calculate([toCarbonInput(visit.metrics)]));
  });

  it("charges a heavier page more than a lighter one", async () => {
    // Arrange
    const light = observation({
      tabId: 1,
      resource: [{ transferSize: 50_000, thirdParty: false }],
    });
    const heavy = observation({
      tabId: 2,
      url: "https://heavy.example.com/",
      resource: [{ transferSize: 12_000_000, thirdParty: false }],
    });

    // Act
    await intake.record(light);
    await intake.record(heavy);

    // Assert
    const { visits } = await store.getDailyRecord();
    const lightCo2 = visits.find((visit) => visit.tabId === 1)!.carbon.totalCo2;
    const heavyCo2 = visits.find((visit) => visit.tabId === 2)!.carbon.totalCo2;
    expect(heavyCo2).toBeGreaterThan(lightCo2);
  });

  it("adds every recorded page into the day's totals", async () => {
    // Act
    await intake.record(
      observation({ tabId: 1, resource: [{ transferSize: 1_000_000, thirdParty: false }] }),
    );
    await intake.record(
      observation({
        tabId: 2,
        url: "https://other.example.com/",
        resource: [{ transferSize: 3_000_000, thirdParty: false }],
      }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.totalMetrics.totalResourceSize).toBeCloseTo(4, 10);
    expect(record.totalCarbon.totalCo2).toBeCloseTo(
      record.visits.reduce((sum, visit) => sum + visit.carbon.totalCo2, 0),
      10,
    );
  });
});

describe("MetricsIntake — what it refuses", () => {
  it("discards a page whose url is not http(s)", async () => {
    // Act
    await intake.record(observation({ url: "chrome://extensions" }));

    // Assert
    expect((await store.getDailyRecord()).visits).toHaveLength(0);
  });

  it("discards an unparseable url", async () => {
    // Act
    await intake.record(observation({ url: "not a url" }));

    // Assert
    expect((await store.getDailyRecord()).visits).toHaveLength(0);
  });

  it("discards an observation with no resource entry", async () => {
    // Act
    await intake.record(observation({ resource: [] }));

    // Assert
    expect((await store.getDailyRecord()).visits).toHaveLength(0);
  });
});

describe("MetricsIntake — re-observing the same tab", () => {
  it("updates the existing entry instead of adding a second one", async () => {
    // Arrange
    await intake.record(
      observation({ tabId: 7, resource: [{ transferSize: 1_000_000, thirdParty: false }] }),
    );

    // Act
    await intake.record(
      observation({ tabId: 7, resource: [{ transferSize: 4_000_000, thirdParty: false }] }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
    expect(record.visits[0].metrics.totalResourceSize).toBeCloseTo(4, 10);
    expect(record.totalMetrics.totalResourceSize).toBeCloseTo(4, 10);
  });

  it("records two concurrent observations of one tab as a single entry", async () => {
    // Arrange — both land before either write settles, which is exactly how a
    // reload storm arrives. Deciding add-or-update outside the write queue
    // produced two entries here and double-counted the day.
    const first = intake.record(
      observation({ tabId: 7, resource: [{ transferSize: 1_000_000, thirdParty: false }] }),
    );
    const second = intake.record(
      observation({ tabId: 7, resource: [{ transferSize: 2_000_000, thirdParty: false }] }),
    );

    // Act
    await Promise.all([first, second]);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits).toHaveLength(1);
    expect(record.totalMetrics.totalResourceSize).toBe(record.visits[0].metrics.totalResourceSize);
  });

  it("keeps distinct tabs apart under concurrency", async () => {
    // Arrange
    const observations = [1, 2, 3].map((tabId) =>
      observation({ tabId, url: `https://site-${tabId}.example.com/` }),
    );

    // Act
    await Promise.all(observations.map((each) => intake.record(each)));

    // Assert
    const record = await store.getDailyRecord();
    expect(record.visits.map((visit) => visit.tabId).sort()).toEqual([1, 2, 3]);
  });
});
