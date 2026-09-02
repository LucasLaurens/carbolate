import type { Clock } from "../../src/utils/clock";
import { toDailyDate } from "../../src/utils/clock";

/**
 * A real `Clock` whose hands do not move on their own — a concrete
 * implementation, not a configured stub. Lives in the test tree so no shipped
 * bundle carries it.
 */
export class FixedClock implements Clock {
  private ms: number;

  constructor(date: string, ms?: number) {
    // Midday keeps the local day unambiguous whatever the runner's timezone.
    this.ms = ms ?? new Date(`${date}T12:00:00`).getTime();
  }

  readDailyDate(): string {
    return toDailyDate(this.now());
  }

  nowMs(): number {
    return this.ms;
  }

  now(): Date {
    return new Date(this.ms);
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}
