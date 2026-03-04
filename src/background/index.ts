import { metricsStore } from "../session/store";
import { ChromeStorage } from "../storage/ChromeStorage";

const DAILY_RESET_ALARM = "daily-reset";

function scheduleDailyReset(): void {
  const now = new Date();
  const midnight = new Date();
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const delayInMinutes = (midnight.getTime() - now.getTime()) / 60000;

  chrome.alarms.create(DAILY_RESET_ALARM, {
    delayInMinutes,
    periodInMinutes: 24 * 60,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "BETA" });
  scheduleDailyReset();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleDailyReset();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== DAILY_RESET_ALARM) return;
  const prefs = await ChromeStorage.getPreferences();
  await metricsStore.clearPastDays(prefs.retentionDays);
});
