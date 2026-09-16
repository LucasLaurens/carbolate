import CarbonCalculator from "../carbon/CarbonCalculator";
import { computeResetPeriodMinutes } from "../config/retention";
import type { Preferences } from "../config/types";
import { MetricsIntake } from "../intake/MetricsIntake";
import { getTranslations } from "../i18n";
import { isPageMetricsMessage } from "../messaging/messages";
import { createMetricsStore } from "../session/store";
import { ChromeStorage } from "../storage/ChromeStorage";
import { StorageKey } from "../storage/StorageKey";
import { SystemClock } from "../utils/clock";
import { exportToCSV } from "../utils/csv";
import { refreshBadge } from "./badge";
import type { BadgeSurface } from "./badge";
import { runResetCycle } from "./resetCycle";

const RESET_ALARM = "reset";
// Firefox silently reschedules any alarm asked to fire in under a minute.
const MIN_ALARM_DELAY_MINUTES = 1;
const MS_PER_MINUTE = 60_000;

const clock = new SystemClock();
const store = createMetricsStore(ChromeStorage, clock);
const intake = new MetricsIntake(store, new CarbonCalculator());

const badge: BadgeSurface = {
  setText: (text) => void chrome.action.setBadgeText({ text }),
  setBackgroundColor: (color) => void chrome.action.setBadgeBackgroundColor({ color }),
  setTitle: (title) => void chrome.action.setTitle({ title }),
};

/**
 * Runs a listener's asynchronous work with a failure path.
 *
 * Every listener below is fire-and-forget: the browser ignores the promise an
 * `async` listener returns, so a rejection became an unhandled promise and the
 * work simply did not happen. `chrome.storage.local` is the one that really
 * rejects — it does so once its quota is reached — and losing that quietly is
 * what could turn a full store into what reads as an empty day.
 *
 * Logging is the whole remedy on purpose: there is no user-facing surface here
 * to raise, and every caller is retried by the next page load or the next alarm.
 */
function runInBackground(what: string, task: () => Promise<void>): void {
  void task().catch((error: unknown) => console.error(`Carbolate: ${what} failed`, error));
}

/**
 * The badge does not survive a browser restart, and the grade it shows expires
 * the moment the day rolls over or a page is measured — so every path that can
 * move the day's total ends here.
 */
async function paintBadge(): Promise<void> {
  const { language } = await ChromeStorage.getPreferences();
  await refreshBadge(store, badge, getTranslations(language));
}

function scheduleReset(preferences: Preferences): void {
  const nextMidnight = clock.now();
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  const delayInMinutes = (nextMidnight.getTime() - clock.nowMs()) / MS_PER_MINUTE;

  chrome.alarms.create(RESET_ALARM, {
    delayInMinutes: Math.max(delayInMinutes, MIN_ALARM_DELAY_MINUTES),
    periodInMinutes: computeResetPeriodMinutes(preferences.retentionDays),
  });
}

chrome.runtime.onInstalled.addListener(() =>
  runInBackground("onInstalled", async () => {
    scheduleReset(await ChromeStorage.getPreferences());
    await paintBadge();
  }),
);

chrome.runtime.onStartup.addListener(() =>
  runInBackground("onStartup", async () => {
    scheduleReset(await ChromeStorage.getPreferences());
    await paintBadge();
  }),
);

async function enforceRetention(preferences: Preferences): Promise<void> {
  try {
    await runResetCycle(store, (records) => exportToCSV(records, clock), preferences, clock.now());
  } catch (error) {
    // Deliberately swallowed: the days are still there and the alarm is periodic,
    // so the next tick retries. Throwing here only logs an unhandled rejection.
    console.error("Reset skipped — the CSV export before it failed", error);
  }
}

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name !== RESET_ALARM) return;
  runInBackground("reset alarm", async () => {
    await enforceRetention(await ChromeStorage.getPreferences());
    await paintBadge();
  });
});

/**
 * The panel writes the preference, the background owns the alarm, and the two are
 * separate JavaScript realities sharing no memory. Without this listener a new
 * window only took effect at the next browser start: the panel would read
 * "7 days" while the alarm still ran daily.
 *
 * Rescheduling alone is not enough. The panel warns that shrinking the window
 * destroys days; that warning has to be true when it is dismissed, not hours
 * later at the next tick. Widening costs nothing — the cycle drops nothing, so
 * it exports nothing.
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const change = changes[StorageKey.PREFERENCES];
  if (change === undefined) return;

  const previous = change.oldValue as Partial<Preferences> | undefined;
  runInBackground("preference change", async () => {
    const preferences = await ChromeStorage.getPreferences();
    // The tooltip is translated, so a language change makes it stale on its own.
    await paintBadge();
    // Every page load writes `sessions`, and a language change writes `preferences`.
    // Neither may reach a path that deletes days.
    if (previous?.retentionDays === preferences.retentionDays) return;

    scheduleReset(preferences);
    await enforceRetention(preferences);
  });
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isPageMetricsMessage(message)) return false;

  // `sender.url` is the sending frame and needs no permission, unlike
  // `sender.tab.url` which Firefox withholds until host access is granted.
  const tabId = sender.tab?.id;
  const url = sender.url ?? sender.tab?.url;
  if (tabId === undefined || url === undefined) return false;

  runInBackground("recording a page visit", async () => {
    await intake.record({
      tabId,
      url,
      measurement: message.measurement,
      timeOrigin: message.timeOrigin,
      observedFrom: message.observedFrom,
    });
    await paintBadge();
  });
  return false;
});
