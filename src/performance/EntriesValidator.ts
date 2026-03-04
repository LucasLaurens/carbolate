import { EntriesEnum } from "./enums/EntriesEnum";

export default class EntriesValidator {
  private entries: Partial<Record<EntriesEnum, PerformanceEntry[]>>;

  constructor(entries: Partial<Record<EntriesEnum, PerformanceEntry[]>>) {
    this.entries = entries;
  }

  validate(): boolean {
    return (this.entries[EntriesEnum.RESOURCE]?.length ?? 0) > 0;
  }

  message(): string {
    return "Unable to find any entries from the main content page";
  }
}
