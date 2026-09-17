import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "./RateLimiter";
import { FixedClock } from "../../test/fakes/FixedClock";

describe("RateLimiter", () => {
  let limiter: RateLimiter;
  let testClock: FixedClock;

  beforeEach(() => {
    testClock = new FixedClock("2026-01-01", 0);
    limiter = new RateLimiter(testClock);
  });

  describe("within limit", () => {
    it("allows the first 10 calls for an action", () => {
      for (let i = 0; i < 10; i++) {
        expect(limiter.isAllowed("csv-export")).toBe(true);
      }
    });

    it("blocks the 11th call", () => {
      for (let i = 0; i < 10; i++) limiter.isAllowed("csv-export");
      expect(limiter.isAllowed("csv-export")).toBe(false);
    });

    it("blocks all subsequent calls within the same window", () => {
      for (let i = 0; i < 10; i++) limiter.isAllowed("csv-export");
      for (let i = 0; i < 20; i++) {
        expect(limiter.isAllowed("csv-export")).toBe(false);
      }
    });

    it("restores access after the 60s window resets", () => {
      for (let i = 0; i < 10; i++) limiter.isAllowed("csv-export");
      testClock.advance(60_001);
      for (let i = 0; i < 10; i++) {
        expect(limiter.isAllowed("csv-export")).toBe(true);
      }
      expect(limiter.isAllowed("csv-export")).toBe(false);
    });
  });

  describe("quadratic throttle escalation", () => {
    it("initial block enforces a 1s throttle (excess=1)", () => {
      for (let i = 0; i < 10; i++) limiter.isAllowed("csv-export");
      limiter.isAllowed("csv-export"); // excess=1, throttleUntil = now+1000

      testClock.advance(999);
      expect(limiter.isAllowed("csv-export")).toBe(false);
    });

    it("second violation enforces a 4s throttle (excess=2)", () => {
      for (let i = 0; i < 10; i++) limiter.isAllowed("csv-export");
      limiter.isAllowed("csv-export"); // excess=1, throttleUntil = now+1000
      limiter.isAllowed("csv-export"); // excess=2, throttleUntil = now+4000

      testClock.advance(3999);
      expect(limiter.isAllowed("csv-export")).toBe(false);
    });

    it("third violation enforces a 9s throttle (excess=3)", () => {
      for (let i = 0; i < 10; i++) limiter.isAllowed("csv-export");
      limiter.isAllowed("csv-export"); // excess=1, throttleUntil = now+1000
      limiter.isAllowed("csv-export"); // excess=2, throttleUntil = now+4000
      limiter.isAllowed("csv-export"); // excess=3, throttleUntil = now+9000

      testClock.advance(8999);
      expect(limiter.isAllowed("csv-export")).toBe(false);
    });
  });

  describe("action isolation", () => {
    it("tracks limits independently per action", () => {
      for (let i = 0; i < 10; i++) limiter.isAllowed("csv-export");
      expect(limiter.isAllowed("csv-export")).toBe(false);
      expect(limiter.isAllowed("pdf-export")).toBe(true);
    });

    it("different actions do not share quota", () => {
      for (let i = 0; i < 10; i++) {
        expect(limiter.isAllowed("csv-export")).toBe(true);
        expect(limiter.isAllowed("pdf-export")).toBe(true);
      }
    });
  });
});
