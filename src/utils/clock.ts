export interface Clock {
  dailyDate(): string;
  nowMs(): number;
  now(): Date;
}

export class SystemClock implements Clock {
  dailyDate(): string {
    return new Date().toLocaleDateString("sv");
  }
  nowMs(): number {
    return Date.now();
  }
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  private _ms: number;

  constructor(date: string, ms?: number) {
    this._ms = ms ?? new Date(`${date}T12:00:00`).getTime();
  }

  dailyDate(): string {
    return new Date(this._ms).toLocaleDateString("sv");
  }
  nowMs(): number {
    return this._ms;
  }
  now(): Date {
    return new Date(this._ms);
  }

  advance(ms: number): void {
    this._ms += ms;
  }
}

let _clock: Clock = new SystemClock();

export const clock = {
  dailyDate: (): string => _clock.dailyDate(),
  nowMs: (): number => _clock.nowMs(),
  now: (): Date => _clock.now(),
};

export function setTestClock(c: Clock): void {
  _clock = c;
}

export function resetClock(): void {
  _clock = new SystemClock();
}
