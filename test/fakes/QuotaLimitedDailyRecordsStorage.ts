import type { DailyRecordsStorage } from "../../src/storage/types";
import type { DailyRecordsStore } from "../../src/session/types";

/**
 * A real storage with a real ceiling: it keeps its bytes in a variable and
 * refuses a write that would not fit, the way `chrome.storage.local` refuses one
 * past its quota. The limit is a number of bytes, not a flag to flip — a full
 * store is reached by writing too much, exactly as in production.
 */
export class QuotaLimitedDailyRecordsStorage implements DailyRecordsStorage {
  private sessions: DailyRecordsStore = {};

  constructor(private readonly quotaBytes: number) {}

  getSessions(): Promise<DailyRecordsStore> {
    return Promise.resolve(this.sessions);
  }

  setSessions(sessions: DailyRecordsStore): Promise<void> {
    const size = JSON.stringify(sessions).length;
    if (size > this.quotaBytes) {
      return Promise.reject(
        new Error(`QUOTA_BYTES quota exceeded: ${size} > ${this.quotaBytes} bytes`),
      );
    }
    this.sessions = sessions;
    return Promise.resolve();
  }

  dates(): string[] {
    return Object.keys(this.sessions).sort();
  }

  countVisits(date: string): number {
    return this.sessions[date]?.visits.length ?? 0;
  }
}
