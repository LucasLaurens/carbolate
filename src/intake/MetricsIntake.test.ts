import { describe, it, expect, beforeEach } from "vitest";
import { MetricsIntake } from "./MetricsIntake";
import type { PageObservation } from "./MetricsIntake";
import CarbonCalculator from "../carbon/CarbonCalculator";
import { toCarbonInput } from "../carbon/toCarbonInput";
import { createMetricsStore } from "../session/store";
import type { MetricsStore } from "../session/types";
import { PerformanceEntryType } from "../performance/enums/PerformanceEntryType";
import { InMemoryDailyRecordsStorage } from "../../test/fakes/InMemoryDailyRecordsStorage";
import { FixedClock } from "../../test/fakes/FixedClock";

const observation = (
  overrides: Partial<PageObservation> & {
    resource?: { transferSize: number }[];
    navigation?: { duration: number }[];
  } = {},
): PageObservation => ({
  tabId: overrides.tabId ?? 7,
  url: overrides.url ?? "https://blog.example.com/article",
  payload: {
    [PerformanceEntryType.RESOURCE]: overrides.resource ?? [{ transferSize: 1_500_000 }],
    [PerformanceEntryType.NAVIGATION]: overrides.navigation ?? [{ duration: 2_400 }],
  },
});

let storage: InMemoryDailyRecordsStorage;
let store: MetricsStore;
let intake: MetricsIntake;
let clock: FixedClock;

beforeEach(() => {
  storage = new InMemoryDailyRecordsStorage();
  clock = new FixedClock("2026-02-23");
  store = createMetricsStore(storage, clock);
  intake = new MetricsIntake(store, new CarbonCalculator(), clock);
});

describe("MetricsIntake — what reaches the daily record", () => {
  it("records the visited page under its own domain", async () => {
    // Act
    await intake.record(observation({ url: "https://shop.example.com/products?q=1" }));

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs).toHaveLength(1);
    expect(record.tabs[0].domain).toBe("shop.example.com");
    expect(record.tabs[0].url).toBe("https://shop.example.com/products?q=1");
  });

  it("stores transferred data in megabytes and load duration in seconds", async () => {
    // Act
    await intake.record(
      observation({ resource: [{ transferSize: 1_500_000 }], navigation: [{ duration: 2_400 }] }),
    );

    // Assert — base 10: 1 500 000 bytes = 1.5 MB, 2 400 ms = 2.4 s
    const [tab] = (await store.getDailyRecord()).tabs;
    expect(tab.metrics.totalResourceSize).toBeCloseTo(1.5, 10);
    expect(tab.metrics.cpuTimeToLoad).toBeCloseTo(2.4, 10);
  });

  it("counts one request per resource entry", async () => {
    // Act
    await intake.record(
      observation({
        resource: [{ transferSize: 10 }, { transferSize: 20 }, { transferSize: 0 }],
      }),
    );

    // Assert
    const [tab] = (await store.getDailyRecord()).tabs;
    expect(tab.metrics.requestCount).toBe(3);
  });

  it("stamps the visit with the clock, not with a hardcoded date", async () => {
    // Act
    await intake.record(observation());

    // Assert
    const [tab] = (await store.getDailyRecord()).tabs;
    expect(tab.meta.date).toBe(clock.nowMs());
  });

  it("keeps the stored carbon reproducible from the stored metrics", async () => {
    // Arrange
    const calculator = new CarbonCalculator();

    // Act
    await intake.record(observation());

    // Assert — the invariant the megabyte round-trip exists to protect: costing
    // the raw bytes instead of the stored value would drift from this.
    const [tab] = (await store.getDailyRecord()).tabs;
    expect(tab.carbon).toEqual(calculator.calculate([toCarbonInput(tab.metrics)]));
  });

  it("charges a heavier page more than a lighter one", async () => {
    // Arrange
    const light = observation({ tabId: 1, resource: [{ transferSize: 50_000 }] });
    const heavy = observation({
      tabId: 2,
      url: "https://heavy.example.com/",
      resource: [{ transferSize: 12_000_000 }],
    });

    // Act
    await intake.record(light);
    await intake.record(heavy);

    // Assert
    const { tabs } = await store.getDailyRecord();
    const lightCo2 = tabs.find((tab) => tab.id === 1)!.carbon.totalCo2;
    const heavyCo2 = tabs.find((tab) => tab.id === 2)!.carbon.totalCo2;
    expect(heavyCo2).toBeGreaterThan(lightCo2);
  });

  it("adds every recorded page into the day's totals", async () => {
    // Act
    await intake.record(observation({ tabId: 1, resource: [{ transferSize: 1_000_000 }] }));
    await intake.record(
      observation({
        tabId: 2,
        url: "https://other.example.com/",
        resource: [{ transferSize: 3_000_000 }],
      }),
    );

    // Assert
    const record = await store.getDailyRecord();
    expect(record.totalMetrics.totalResourceSize).toBeCloseTo(4, 10);
    expect(record.totalCarbon.totalCo2).toBeCloseTo(
      record.tabs.reduce((sum, tab) => sum + tab.carbon.totalCo2, 0),
      10,
    );
  });
});

describe("MetricsIntake — what it refuses", () => {
  it("discards a page whose url is not http(s)", async () => {
    // Act
    await intake.record(observation({ url: "chrome://extensions" }));

    // Assert
    expect((await store.getDailyRecord()).tabs).toHaveLength(0);
  });

  it("discards an unparseable url", async () => {
    // Act
    await intake.record(observation({ url: "not a url" }));

    // Assert
    expect((await store.getDailyRecord()).tabs).toHaveLength(0);
  });

  it("discards an observation with no resource entry", async () => {
    // Act
    await intake.record(observation({ resource: [] }));

    // Assert
    expect((await store.getDailyRecord()).tabs).toHaveLength(0);
  });
});

describe("MetricsIntake — re-observing the same tab", () => {
  it("updates the existing entry instead of adding a second one", async () => {
    // Arrange
    await intake.record(observation({ tabId: 7, resource: [{ transferSize: 1_000_000 }] }));

    // Act
    await intake.record(observation({ tabId: 7, resource: [{ transferSize: 4_000_000 }] }));

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs).toHaveLength(1);
    expect(record.tabs[0].metrics.totalResourceSize).toBeCloseTo(4, 10);
    expect(record.totalMetrics.totalResourceSize).toBeCloseTo(4, 10);
  });

  it("records two concurrent observations of one tab as a single entry", async () => {
    // Arrange — both land before either write settles, which is exactly how a
    // reload storm arrives. Deciding add-or-update outside the write queue
    // produced two entries here and double-counted the day.
    const first = intake.record(observation({ tabId: 7, resource: [{ transferSize: 1_000_000 }] }));
    const second = intake.record(
      observation({ tabId: 7, resource: [{ transferSize: 2_000_000 }] }),
    );

    // Act
    await Promise.all([first, second]);

    // Assert
    const record = await store.getDailyRecord();
    expect(record.tabs).toHaveLength(1);
    expect(record.totalMetrics.totalResourceSize).toBe(record.tabs[0].metrics.totalResourceSize);
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
    expect(record.tabs.map((tab) => tab.id).sort()).toEqual([1, 2, 3]);
  });
});
