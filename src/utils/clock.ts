/**
 * "sv" is the only locale whose short date is already ISO `YYYY-MM-DD`, and the
 * local timezone is deliberate: a UTC boundary would file a European evening's
 * browsing under the wrong day.
 */
export const toDailyDate = (date: Date): string => date.toLocaleDateString("sv");

export interface Clock {
  dailyDate(): string;
  nowMs(): number;
  now(): Date;
}

export class SystemClock implements Clock {
  dailyDate(): string {
    return toDailyDate(this.now());
  }

  nowMs(): number {
    return Date.now();
  }

  now(): Date {
    return new Date();
  }
}
