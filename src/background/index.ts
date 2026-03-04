import { metricsStore } from "../session/store";
import { ChromeStorage } from "../storage/ChromeStorage";
import type { Preferences } from "../config/preferences";
import { parseDomain } from "../utils/url";
import EntriesValidator from "../performance/EntriesValidator";
import { StrategyContext } from "../performance/StrategyContext";
import ResourceStrategy from "../performance/ResourceStrategy";

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

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "page_metrics") return false;
  if (!sender.tab?.id || !sender.tab?.url) return false;

  const { resource, navigation } = message as {
    resource: { transferSize: number }[];
    navigation: { duration: number }[];
  };
  const tabId = sender.tab.id;
  const url = sender.tab.url;
  const domain = parseDomain(url);

  const validator = new EntriesValidator({ resource, navigation } as never);
  if (!validator.validate()) return false;

  const strategyContext = new StrategyContext(new ResourceStrategy());
  const { resourceCount, totalTransferSize } = strategyContext.execute(resource);
  const metrics = {
    requestCount: resourceCount,
    totalResourceSize: totalTransferSize / (1024 * 1024),
    cpuTimeToLoad: navigation?.[0]?.duration ? navigation[0].duration / 1000 : 0,
  };

  (async () => {
    const hasExisting = await metricsStore.hasExistingTabById(tabId);
    if (!hasExisting) {
      await metricsStore.addTab({ id: tabId, url, domain, metrics, meta: { status: 200, date: Date.now() } });
    } else {
      await metricsStore.updateTabMetrics(tabId, metrics, { status: 200, date: Date.now() });
    }
  })();

  return false;
});
