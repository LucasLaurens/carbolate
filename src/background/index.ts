import { metricsStore } from "../session/store";
import { ChromeStorage } from "../storage/ChromeStorage";
import type { Preferences } from "../config/types";
import { parseDomain } from "../utils/url";
import PageMetricsValidator from "../performance/PageMetricsValidator";
import { MetricsProcessorContext } from "../performance/MetricsProcessorContext";
import NetworkMetricsExtractor from "../performance/NetworkMetricsExtractor";
import CarbonCalculator from "../carbon/CarbonCalculator";
import type { CarbonInput } from "../carbon/types";
import type { Metrics } from "../session/types";
import { clock } from "../utils/clock";

const RESET_ALARM = "reset";
// Firefox silently reschedules any alarm asked to fire in under a minute.
const MIN_ALARM_DELAY_MINUTES = 1;
const calculator = new CarbonCalculator();

const toCarbonInput = (m: Metrics): CarbonInput => ({
  transferSize: m.totalResourceSize * 1024 * 1024, // MiB → bytes
  cpuTime: m.cpuTimeToLoad * 1000, // s → ms
});

function scheduleReset(prefs: Preferences): void {
  const now = clock.now();
  const midnight = clock.now();
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const delayInMinutes = (midnight.getTime() - now.getTime()) / 60000;
  const periodInMinutes = prefs.resetPeriod === "weekly" ? 7 * 24 * 60 : 24 * 60;

  chrome.alarms.create(RESET_ALARM, {
    delayInMinutes: Math.max(delayInMinutes, MIN_ALARM_DELAY_MINUTES),
    periodInMinutes,
  });
}

async function handlePageMetrics(
  resource: { transferSize: number }[],
  navigation: { duration: number }[],
  tabId: number,
  url: string,
): Promise<void> {
  const parsed = parseDomain(url);
  if (!parsed.valid) return;
  const validator = new PageMetricsValidator({ resource, navigation } as never);
  if (!validator.validate()) return;

  const processor = new MetricsProcessorContext(new NetworkMetricsExtractor());
  const { resourceCount, totalTransferSize } = processor.execute(resource);
  const metrics: Metrics = {
    requestCount: resourceCount,
    totalResourceSize: totalTransferSize / (1024 * 1024),
    cpuTimeToLoad: navigation?.[0]?.duration ? navigation[0].duration / 1000 : 0,
  };
  const carbon = calculator.calculate([toCarbonInput(metrics)]);

  const hasExisting = await metricsStore.hasExistingTabById(tabId);
  if (!hasExisting) {
    await metricsStore.addTab({
      id: tabId,
      url,
      domain: parsed.domain,
      metrics,
      carbon,
      meta: { status: 200, date: clock.nowMs() },
    });
  } else {
    await metricsStore.updateTabMetrics(tabId, metrics, carbon, {
      status: 200,
      date: Date.now(),
    });
  }
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

chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name !== RESET_ALARM) return;
  const prefs = await ChromeStorage.getPreferences();
  await metricsStore.clearPastDays(prefs.retentionDays);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "page_metrics") return false;

  // `sender.url` is the sending frame and needs no permission, unlike
  // `sender.tab.url` which Firefox withholds until host access is granted.
  const tabId = sender.tab?.id;
  const url = sender.url ?? sender.tab?.url;
  if (!tabId || !url) return false;

  const { resource, navigation } = message as {
    resource: { transferSize: number }[];
    navigation: { duration: number }[];
  };

  handlePageMetrics(resource, navigation, tabId, url);
  return false;
});
