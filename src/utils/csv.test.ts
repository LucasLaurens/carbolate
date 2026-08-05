import { describe, it, expect } from "vitest";
import { toCSV } from "./csv";
import { emptyDailyRecord } from "../session/aggregator";
import type { DailyRecord, MetricTab } from "../session/types";

const HEADER =
  "date,domain,url,requestCount,totalResourceSize_MB,cpuTimeToLoad_s," +
  "networkCo2_g,cpuCo2_g,renderingCo2_g,totalCo2_g,visitTimestamp";

const tab = (overrides: Partial<MetricTab> = {}): MetricTab => ({
  id: 1,
  url: "https://example.com/page",
  domain: "example.com",
  metrics: { requestCount: 12, totalResourceSize: 1.5, cpuTimeToLoad: 2.4 },
  meta: { date: 1_772_000_000_000 },
  carbon: { networkCo2: 0.26, cpuCo2: 0.0024, renderingCo2: 0.00096, totalCo2: 0.26336 },
  ...overrides,
});

const day = (date: string, tabs: MetricTab[]): DailyRecord => ({
  ...emptyDailyRecord(date),
  tabs,
});

describe("toCSV", () => {
  it("writes only the header when there is nothing to export", () => {
    // Act & Assert
    expect(toCSV([])).toBe(HEADER);
  });

  it("writes one row per tab, headed by the column names", () => {
    // Arrange
    const records = [day("2026-02-23", [tab({ id: 1 }), tab({ id: 2 })])];

    // Act
    const lines = toCSV(records).split("\n");

    // Assert
    expect(lines[0]).toBe(HEADER);
    expect(lines).toHaveLength(3);
  });

  it("carries the day of each record onto its rows", () => {
    // Arrange
    const records = [day("2026-02-22", [tab()]), day("2026-02-23", [tab()])];

    // Act
    const [, first, second] = toCSV(records).split("\n");

    // Assert
    expect(first.startsWith("2026-02-22,")).toBe(true);
    expect(second.startsWith("2026-02-23,")).toBe(true);
  });

  it("quotes a url containing a comma so the column count survives", () => {
    // Arrange
    const records = [day("2026-02-23", [tab({ url: "https://example.com/a,b" })])];

    // Act
    const [, row] = toCSV(records).split("\n");

    // Assert
    expect(row).toContain('"https://example.com/a,b"');
    expect(row.split(",")).toHaveLength(HEADER.split(",").length + 1);
  });

  it("doubles an embedded quote rather than breaking the field", () => {
    // Arrange
    const records = [day("2026-02-23", [tab({ url: 'https://example.com/"q"' })])];

    // Act
    const [, row] = toCSV(records).split("\n");

    // Assert
    expect(row).toContain('"https://example.com/""q"""');
  });

  it("exports a legacy tab with no renderingCo2 as zero instead of blank", () => {
    // Arrange — days recorded before the rendering source existed
    const legacy = tab({
      carbon: { networkCo2: 0.1, cpuCo2: 0.002, totalCo2: 0.102 } as MetricTab["carbon"],
    });

    // Act
    const [, row] = toCSV([day("2026-02-23", [legacy])]).split("\n");

    // Assert
    expect(row.split(",")[8]).toBe("0");
  });

  it("emits nothing for a day that recorded no tab", () => {
    // Act
    const lines = toCSV([day("2026-02-23", [])]).split("\n");

    // Assert
    expect(lines).toEqual([HEADER]);
  });
});
