import { isKept } from "../config/retention";
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
 * A cycle that would drop nothing does nothing at all. The alarm fires on a
 * period the window derives, and the panel now fires this same cycle whenever
 * `retentionDays` changes — including when it *widens*, where every stored day
 * survives. "Export before deleting" that downloads a CSV without deleting is
 * a file the user never asked for.
 *
 * O(n) time and space — n = tabs across every stored day, from the CSV the
 * exporter builds.
 */
export async function runResetCycle(
  store: DailyRecordReader & RetentionEnforcer,
  exportRecords: RecordsExporter,
  preferences: Preferences,
  today: Date,
): Promise<void> {
  const records = await store.getAllDays();
  const dropsNothing = records.every((record) =>
    isKept(record.date, preferences.retentionDays, today),
  );
  if (dropsNothing) return;

  if (preferences.autoExportBeforeReset) {
    await exportRecords(records);
  }
  await store.clearPastDays(preferences.retentionDays);
}
