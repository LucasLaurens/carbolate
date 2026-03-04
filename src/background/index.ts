import { metricsStore } from "../session/store";
import { ChromeStorage } from "../storage/ChromeStorage";
import type { Preferences } from "../config/preferences";

const RESET_ALARM = "reset";

function scheduleReset(prefs: Preferences): void {
  const now = new Date();
  const midnight = new Date();
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const delayInMinutes = (midnight.getTime() - now.getTime()) / 60000;
  const periodInMinutes = prefs.resetPeriod === "weekly" ? 7 * 24 * 60 : 24 * 60;

  chrome.alarms.create(RESET_ALARM, { delayInMinutes, periodInMinutes });
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.action.setBadgeText({ text: "BETA" });
  const prefs = await ChromeStorage.getPreferences();
  scheduleReset(prefs);
});

chrome.runtime.onStartup.addListener(async () => {
  const prefs = await ChromeStorage.getPreferences();
  scheduleReset(prefs);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== RESET_ALARM) return;
  const prefs = await ChromeStorage.getPreferences();
  await metricsStore.clearPastDays(prefs.retentionDays);
});
