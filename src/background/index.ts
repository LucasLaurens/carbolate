import CarbonCalculator from "../carbon/CarbonCalculator";
import { resetPeriodMinutes } from "../config/retention";
import type { Preferences } from "../config/types";
import { MetricsIntake } from "../intake/MetricsIntake";
import { isPageMetricsMessage } from "../messaging/messages";
import { createMetricsStore } from "../session/store";
import { ChromeStorage } from "../storage/ChromeStorage";
import { SystemClock } from "../utils/clock";

const RESET_ALARM = "reset";
// Firefox silently reschedules any alarm asked to fire in under a minute.
const MIN_ALARM_DELAY_MINUTES = 1;
const MS_PER_MINUTE = 60_000;

const clock = new SystemClock();
const store = createMetricsStore(ChromeStorage, clock);
const intake = new MetricsIntake(store, new CarbonCalculator(), clock);

function scheduleReset(preferences: Preferences): void {
  const nextMidnight = clock.now();
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  const delayInMinutes = (nextMidnight.getTime() - clock.nowMs()) / MS_PER_MINUTE;

  chrome.alarms.create(RESET_ALARM, {
    delayInMinutes: Math.max(delayInMinutes, MIN_ALARM_DELAY_MINUTES),
    periodInMinutes: resetPeriodMinutes(preferences.retentionDays),
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.action.setBadgeText({ text: "BETA" });
  scheduleReset(await ChromeStorage.getPreferences());
});

chrome.runtime.onStartup.addListener(async () => {
  scheduleReset(await ChromeStorage.getPreferences());
});

chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name !== RESET_ALARM) return;
  const preferences = await ChromeStorage.getPreferences();
  await store.clearPastDays(preferences.retentionDays);
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isPageMetricsMessage(message)) return false;

  // `sender.url` is the sending frame and needs no permission, unlike
  // `sender.tab.url` which Firefox withholds until host access is granted.
  const tabId = sender.tab?.id;
  const url = sender.url ?? sender.tab?.url;
  if (tabId === undefined || url === undefined) return false;

  void intake.record({ tabId, url, payload: message.payload });
  return false;
});
