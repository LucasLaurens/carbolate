import type { EntriesEnum } from "./enums/EntriesEnum";

export default class EntriesValidator {
  public readonly MIN = 1;
  private entries: Record<EntriesEnum, PerformanceEntry[]>;

  constructor(entries: Record<EntriesEnum, PerformanceEntry[]>) {
    this.entries = entries;
  }

  validate(): boolean {
    return Object.keys(this.entries).length >= this.MIN;
  }

  message(): string {
    return "Unable to find any entries from the main content page";
  }
}
