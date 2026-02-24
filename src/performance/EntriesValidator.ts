import type { EntriesEnum } from "./enums/EntriesEnum";

export default class EntriesValidator {
  private entries: Record<EntriesEnum, PerformanceEntry[]>;

  constructor(entries: Record<EntriesEnum, PerformanceEntry[]>) {
    this.entries = entries;
  }

  validate(): boolean {
    return Object.values(this.entries).some((arr) => arr.length > 0);
  }

  message(): string {
    return "Unable to find any entries from the main content page";
  }
}
