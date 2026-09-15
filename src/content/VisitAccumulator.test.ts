import { describe, it, expect } from "vitest";
import { VisitAccumulator } from "./VisitAccumulator";

const START = 1_771_800_000_000;

describe("VisitAccumulator — what the page measured", () => {
  it("folds every resource it is handed", () => {
    // Arrange
    const accumulator = new VisitAccumulator(true, START);

    // Act
    accumulator.addResource({ transferSize: 1_000 });
    accumulator.addResource({ transferSize: 0, decodedBodySize: 4_000 });

    // Assert
    const measurement = accumulator.readMeasurement(START);
    expect(measurement.requests).toBe(2);
    expect(measurement.transferredBytes).toBe(1_000);
    expect(measurement.cachedBytes).toBe(4_000);
  });

  it("keeps counting after the load, which is the whole point", () => {
    // Arrange
    const accumulator = new VisitAccumulator(true, START);
    accumulator.recordNavigation({ duration: 900 });
    accumulator.addResource({ transferSize: 1_000 });

    // Act — a lazy image, an XHR: bytes that used to be lost
    accumulator.addResource({ transferSize: 500_000 });

    // Assert
    expect(accumulator.readMeasurement(START).transferredBytes).toBe(501_000);
    expect(accumulator.readMeasurement(START).loadDurationMs).toBe(900);
  });
});

describe("VisitAccumulator — visible time", () => {
  it("counts the window still open, so a flush can be repeated", () => {
    // Arrange
    const accumulator = new VisitAccumulator(true, START);

    // Act & Assert — reading closes nothing
    expect(accumulator.readMeasurement(START + 5_000).visibleDurationMs).toBe(5_000);
    expect(accumulator.readMeasurement(START + 10_000).visibleDurationMs).toBe(10_000);
  });

  it("stops counting while the tab is hidden", () => {
    // Arrange
    const accumulator = new VisitAccumulator(true, START);

    // Act
    accumulator.markHidden(START + 4_000);

    // Assert — an hour in the background adds nothing
    expect(accumulator.readMeasurement(START + 3_604_000).visibleDurationMs).toBe(4_000);
  });

  it("resumes where it left off when the tab comes back", () => {
    // Arrange
    const accumulator = new VisitAccumulator(true, START);
    accumulator.markHidden(START + 4_000);

    // Act — a bfcache restore continues the same visit
    accumulator.markVisible(START + 60_000);

    // Assert
    expect(accumulator.readMeasurement(START + 61_000).visibleDurationMs).toBe(5_000);
  });

  it("reports nothing for a tab loaded in the background and never looked at", () => {
    // Arrange — ctrl-clicked link: the document exists, the panel showed none of it
    const accumulator = new VisitAccumulator(false, START);
    accumulator.addResource({ transferSize: 2_000_000 });

    // Act & Assert — the network is charged, the screen is not
    const measurement = accumulator.readMeasurement(START + 600_000);
    expect(measurement.visibleDurationMs).toBe(0);
    expect(measurement.transferredBytes).toBe(2_000_000);
  });

  it("ignores a second visible on an already visible page", () => {
    // Arrange
    const accumulator = new VisitAccumulator(true, START);

    // Act — visibilitychange fires on both edges, pageshow can double up
    accumulator.markVisible(START + 9_000);

    // Assert — restarting the open window would erase the time already counted
    expect(accumulator.readMeasurement(START + 10_000).visibleDurationMs).toBe(10_000);
  });

  it("ignores a second hidden on an already hidden page", () => {
    // Arrange
    const accumulator = new VisitAccumulator(true, START);
    accumulator.markHidden(START + 1_000);

    // Act
    accumulator.markHidden(START + 50_000);

    // Assert
    expect(accumulator.readMeasurement(START + 50_000).visibleDurationMs).toBe(1_000);
  });
});
