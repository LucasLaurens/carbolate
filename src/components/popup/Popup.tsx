import { Component } from "react";
import EntriesValidator from "../../performance/EntriesValidator";
import type { EntriesEnum } from "../../performance/enums/EntriesEnum";
import { StrategyContext } from "../../performance/StrategyContext";
import ResourceStrategy from "../../performance/ResourceStrategy";
import { metricsStore } from "../../session/store";
import type { DailyRecord } from "../../session/types";
import DayView from "./DayView";
import PreferencesView, { DEFAULT_PREFERENCES } from "./PreferencesView";
import type { Preferences } from "./PreferencesView";

type View = "day" | "preferences";

type State = {
  view: View;
  record: DailyRecord | null;
  preferences: Preferences;
};

export default class Popup extends Component<Record<string, never>, State> {
  state: State = {
    view: "day",
    record: null,
    preferences: { ...DEFAULT_PREFERENCES },
  };

  componentDidMount(): void {
    this.loadPreferences();
    this.handleTabMetrics();
  }

  loadPreferences = async () => {
    const stored = await chrome.storage.local.get(["preferences"]);
    if (stored.preferences) {
      this.setState({ preferences: { ...DEFAULT_PREFERENCES, ...stored.preferences } });
    }
  };

  savePreferences = async (prefs: Preferences) => {
    await chrome.storage.local.set({ preferences: prefs });
    this.setState({ preferences: prefs });
  };

  handleTabMetrics = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      tabs.forEach((currentTab: chrome.tabs.Tab) => {
        if (!currentTab.id) return;

        chrome.tabs.sendMessage(
          currentTab.id,
          { type: "entries" },
          async (response?: Record<string, PerformanceEntry[]>) => {
            const validator = new EntriesValidator(response ?? {});
            if (!validator.validate()) {
              await this.refreshRecord();
              return;
            }

            const resource = (response as Record<EntriesEnum, PerformanceResourceTiming[]>)
              .resource;
            const navigation = (response as Record<EntriesEnum, PerformanceEntry[]>).navigation;

            const strategyContext = new StrategyContext(new ResourceStrategy());
            const { resourceCount, totalTransferSize } = strategyContext.execute(resource);

            const newMetrics = {
              requestCount: resourceCount,
              totalResourceSize: totalTransferSize / (1024 * 1024),
              cpuTimeToLoad: navigation?.[0]?.duration ? navigation[0].duration / 1000 : 0,
            };

            const hasExistingTabById = await metricsStore.hasExistingTabById(currentTab.id!);
            if (!hasExistingTabById) {
              const url = currentTab.url ?? "";
              const domain = url ? new URL(url).hostname : "";
              await metricsStore.addTab({
                id: currentTab.id!,
                url,
                domain,
                metrics: newMetrics,
                meta: { status: 200, date: Date.now() },
              });
            } else {
              await metricsStore.updateTabMetrics(currentTab.id!, newMetrics);
            }

            await this.refreshRecord();
          },
        );
      });
    });
  };

  refreshRecord = async () => {
    const record = await metricsStore.findDailyRecord();
    this.setState({ record });
  };

  render() {
    const { view, record, preferences } = this.state;

    return (
      <div className="w-80 p-4 flex flex-col gap-3">
        <div className="flex gap-1 border-b border-gray-200 pb-2">
          <button
            className={`flex-1 py-1 px-2 text-sm font-medium cursor-pointer ${view === "day" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => this.setState({ view: "day" })}
          >
            📊 Aujourd'hui
          </button>
          <button
            className={`flex-1 py-1 px-2 text-sm font-medium cursor-pointer ${view === "preferences" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => this.setState({ view: "preferences" })}
          >
            ⚙️ Préférences
          </button>
        </div>

        {view === "day" && <DayView record={record} onRefresh={this.handleTabMetrics} />}
        {view === "preferences" && (
          <PreferencesView preferences={preferences} onSave={this.savePreferences} />
        )}
      </div>
    );
  }
}
