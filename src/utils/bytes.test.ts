import { describe, it, expect } from "vitest";
import {
  BYTES_PER_MB,
  BYTES_PER_GB,
  MS_PER_SECOND,
  bytesToMegabytes,
  megabytesToBytes,
  bytesToGigabytes,
  millisecondsToSeconds,
  secondsToMilliseconds,
} from "./bytes";

const BYTES_PER_MIB = 1024 * 1024;
const BYTES_PER_GIB = 1024 * 1024 * 1024;

describe("byte units are base 10", () => {
  it("defines a megabyte as 10⁶ bytes, never 2²⁰", () => {
    // Act & Assert
    expect(BYTES_PER_MB).toBe(1_000_000);
    expect(BYTES_PER_MB).not.toBe(BYTES_PER_MIB);
  });

  it("defines a gigabyte as 10⁹ bytes, never 2³⁰", () => {
    // Act & Assert
    expect(BYTES_PER_GB).toBe(1_000_000_000);
    expect(BYTES_PER_GB).not.toBe(BYTES_PER_GIB);
  });

  it("converts a base-2 megabyte to more than one megabyte", () => {
    // Arrange — a base-2 conversion would return exactly 1 here
    const oneMebibyteInBytes = BYTES_PER_MIB;

    // Act
    const megabytes = bytesToMegabytes(oneMebibyteInBytes);

    // Assert
    expect(megabytes).toBeCloseTo(1.048576, 6);
    expect(megabytes).not.toBe(1);
  });

  it("keeps CARBON_PER_GB's unit: a gigabyte is a thousand megabytes", () => {
    // Act & Assert
    expect(BYTES_PER_GB / BYTES_PER_MB).toBe(1_000);
  });
});

describe("conversions round-trip without drift", () => {
  it("returns the original byte count through megabytes and back", () => {
    // Arrange
    const bytes = 3_456_789;

    // Act
    const roundTripped = megabytesToBytes(bytesToMegabytes(bytes));

    // Assert
    expect(roundTripped).toBeCloseTo(bytes, 6);
  });

  it("returns the original duration through seconds and back", () => {
    // Arrange
    const milliseconds = 4_567;

    // Act
    const roundTripped = secondsToMilliseconds(millisecondsToSeconds(milliseconds));

    // Assert
    expect(roundTripped).toBeCloseTo(milliseconds, 6);
  });
});

describe("duration units", () => {
  it("defines a second as 1 000 milliseconds", () => {
    // Act & Assert
    expect(MS_PER_SECOND).toBe(1_000);
  });

  it("converts bytes to gigabytes against the same base as megabytes", () => {
    // Arrange
    const bytes = 2_500_000_000;

    // Act & Assert
    expect(bytesToGigabytes(bytes)).toBeCloseTo(2.5, 6);
    expect(bytesToMegabytes(bytes)).toBeCloseTo(2_500, 6);
  });
});
