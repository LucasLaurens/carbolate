import type { Clock } from "../utils/clock";
import { SystemClock } from "../utils/clock";

const MAX_ATTEMPTS = 10;
const BASE_THROTTLE_MS = 1_000;
const WINDOW_MS = 60_000;

type ActionRecord = {
  count: number;
  windowStart: number;
  throttleUntil: number;
  excess: number;
};

export class RateLimiter {
  private readonly records = new Map<string, ActionRecord>();

  constructor(private readonly clock: Clock = new SystemClock()) {}

  isAllowed(action: string): boolean {
    const now = this.clock.nowMs();
    const record = this.records.get(action);

    if (!record) {
      this.records.set(action, { count: 1, windowStart: now, throttleUntil: 0, excess: 0 });
      return true;
    }

    if (now < record.throttleUntil) {
      record.excess++;
      record.throttleUntil = now + record.excess ** 2 * BASE_THROTTLE_MS;
      return false;
    }

    if (now - record.windowStart > WINDOW_MS) {
      this.records.set(action, { count: 1, windowStart: now, throttleUntil: 0, excess: 0 });
      return true;
    }

    record.count++;

    if (record.count > MAX_ATTEMPTS) {
      record.excess++;
      record.throttleUntil = now + record.excess ** 2 * BASE_THROTTLE_MS;
      return false;
    }

    return true;
  }
}
