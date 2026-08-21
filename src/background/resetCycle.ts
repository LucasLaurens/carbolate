import type { Preferences } from "../config/types";
import type { DailyRecord, DailyRecordReader, RetentionEnforcer } from "../session/types";

/** Hands the days to the browser. Rejects when the download does not start. */
export type RecordsExporter = (records: readonly DailyRecord[]) => Promise<void>;

/**
 * The export runs before the deletion, and a failed export aborts it: a reset
 * that drops days after the export refused loses them with nothing to show for
 * it. The alarm is periodic, so aborting costs one retry — the days survive
 * until an export succeeds, at the price of an unbounded store while it keeps
 * failing.
 *
 * O(n) time and space — n = tabs across every stored day, from the CSV the
 * exporter builds.
 */
export async function runResetCycle(
  store: DailyRecordReader & RetentionEnforcer,
  exportRecords: RecordsExporter,
  preferences: Preferences,
): Promise<void> {
  if (preferences.autoExportBeforeReset) {
    await exportRecords(await store.getAllDays());
  }
  await store.clearPastDays(preferences.retentionDays);
}
