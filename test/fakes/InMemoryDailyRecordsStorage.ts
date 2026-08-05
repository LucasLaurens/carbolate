import type { DailyRecordsStorage } from "../../src/storage/types";
import type { DailyRecordsStore } from "../../src/session/types";

/**
 * A real storage that happens to keep its bytes in a variable. Concrete
 * behaviour, not configured responses: writes are readable, reads reflect
 * writes, and nothing has to be told what to return.
 */
export class InMemoryDailyRecordsStorage implements DailyRecordsStorage {
  private sessions: DailyRecordsStore = {};

  getSessions(): Promise<DailyRecordsStore> {
    return Promise.resolve(this.sessions);
  }

  setSessions(sessions: DailyRecordsStore): Promise<void> {
    this.sessions = sessions;
    return Promise.resolve();
  }

  /** Seeds a past day, so retention can be exercised without waiting a night. */
  seedDay(date: string, record: DailyRecordsStore[string]): void {
    this.sessions = { ...this.sessions, [date]: record };
  }

  dates(): string[] {
    return Object.keys(this.sessions).sort();
  }
}
