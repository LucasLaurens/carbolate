import { PerformanceEntryType } from "./enums/PerformanceEntryType";

export default class PageMetricsValidator {
  private entries: Partial<Record<PerformanceEntryType, PerformanceEntry[]>>;

  constructor(entries: Partial<Record<PerformanceEntryType, PerformanceEntry[]>>) {
    this.entries = entries;
  }

  validate(): boolean {
    return (this.entries[PerformanceEntryType.RESOURCE]?.length ?? 0) > 0;
  }

  message(): string {
    return "Unable to find any entries from the main content page";
  }
}
