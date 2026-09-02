import { describe, it, expect } from "vitest";
import { toCSV } from "./csv";
import { createEmptyDailyRecord } from "../session/aggregator";
import type { DailyRecord, MetricTab } from "../session/types";

const HEADER =
  "date,domain,url,requestCount,totalResourceSize_MB,pageLoadDuration_s,cachedPageWeight_MB," +
  "networkCo2_g,deviceCo2_g,totalCo2_g,avoidedCo2_g,visitTimestamp";

const tab = (overrides: Partial<MetricTab> = {}): MetricTab => ({
  id: 1,
  url: "https://example.com/page",
  domain: "example.com",
  metrics: {
    requestCount: 12,
    totalResourceSize: 1.5,
    pageLoadDurationSec: 2.4,
    cachedPageWeight: 0.8,
  },
  meta: { date: 1_772_000_000_000 },
  carbon: { networkCo2: 0.26, deviceCo2: 0.00336, totalCo2: 0.26336, avoidedCo2: 0.14 },
  ...overrides,
});

const day = (date: string, tabs: MetricTab[]): DailyRecord => ({
  ...createEmptyDailyRecord(date),
  tabs,
});

describe("toCSV", () => {
  it("writes only the header when there is nothing to export", () => {
    expect(toCSV([])).toBe(HEADER);
  });

  it("writes one row per tab, headed by the column names", () => {
    const records = [day("2026-02-23", [tab({ id: 1 }), tab({ id: 2 })])];

    const lines = toCSV(records).split("\n");

    expect(lines[0]).toBe(HEADER);
    expect(lines).toHaveLength(3);
  });

  it("carries the day of each record onto its rows", () => {
    const records = [day("2026-02-22", [tab()]), day("2026-02-23", [tab()])];

    const [, first, second] = toCSV(records).split("\n");

    expect(first.startsWith("2026-02-22,")).toBe(true);
    expect(second.startsWith("2026-02-23,")).toBe(true);
  });

  it("quotes a url containing a comma so the column count survives", () => {
    const records = [day("2026-02-23", [tab({ url: "https://example.com/a,b" })])];

    const [, row] = toCSV(records).split("\n");

    expect(row).toContain('"https://example.com/a,b"');
    expect(row.split(",")).toHaveLength(HEADER.split(",").length + 1);
  });

  it("doubles an embedded quote rather than breaking the field", () => {
    const records = [day("2026-02-23", [tab({ url: 'https://example.com/"q"' })])];

    const [, row] = toCSV(records).split("\n");

    expect(row).toContain('"https://example.com/""q"""');
  });

  it("exports the device figure as one column, not two", () => {
    // Act — the split cpuCo2_g / renderingCo2_g pair propagated a ventilation the
    // measurement never supported
    const [, row] = toCSV([day("2026-02-23", [tab()])]).split("\n");

    // Assert
    expect(HEADER).not.toContain("cpuCo2_g");
    expect(HEADER).not.toContain("renderingCo2_g");
    expect(row.split(",")[8]).toBe("0.00336");
  });

  it("exports avoided CO₂ in its own column, after the total", () => {
    // Act
    const [, row] = toCSV([day("2026-02-23", [tab()])]).split("\n");

    // Assert — a reader must never mistake it for part of the footprint
    const columns = row.split(",");
    expect(columns[9]).toBe("0.26336");
    expect(columns[10]).toBe("0.14");
  });

  it("emits nothing for a day that recorded no tab", () => {
    const lines = toCSV([day("2026-02-23", [])]).split("\n");

    expect(lines).toEqual([HEADER]);
  });
});
