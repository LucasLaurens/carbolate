import { Component } from "react";
import { metricsStore } from "../../session/store";
import { TabCollector } from "../../session/TabCollector";
import { parseDomain } from "../../utils/url";
import { ChromeStorage } from "../../storage/ChromeStorage";
import { DEFAULT_PREFERENCES, type Preferences } from "../../config/preferences";
import type { DailyRecord } from "../../session/types";
import { exportToCSV } from "../../utils/csv";
import DayView from "./DayView";
import PreferencesView from "./PreferencesView";

type View = "day" | "preferences";

type State = {
  view: View;
  record: DailyRecord | null;
  preferences: Preferences;
  isLoading: boolean;
};

const tabCollector = new TabCollector();

export default class Popup extends Component<Record<string, never>, State> {
  state: State = {
    view: "day",
    record: null,
    preferences: { ...DEFAULT_PREFERENCES },
    isLoading: false,
  };

  componentDidMount(): void {
    this.loadPreferences();
    this.handleTabMetrics();
  }

  loadPreferences = async () => {
    try {
      const prefs = await ChromeStorage.getPreferences();
      this.setState({ preferences: prefs });
    } catch (e) {
      console.error("Failed to load preferences", e);
    }
  };

  savePreferences = async (prefs: Preferences) => {
    try {
      await ChromeStorage.setPreferences(prefs);
      this.setState({ preferences: prefs });
    } catch (e) {
      console.error("Failed to save preferences", e);
    }
  };

  handleTabMetrics = () => {
    if (this.state.isLoading) return;
    this.setState({ isLoading: true });

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        for (const currentTab of tabs) {
          if (!currentTab.id) continue;

          const metrics = await tabCollector.collect(currentTab.id);
          if (!metrics) {
            await this.refreshRecord();
            continue;
          }

          const url = currentTab.url ?? "";
          const domain = parseDomain(url);
          const tabId = currentTab.id;

          const hasExisting = await metricsStore.hasExistingTabById(tabId);
          if (!hasExisting) {
            await metricsStore.addTab({
              id: tabId,
              url,
              domain,
              metrics,
              meta: { status: 200, date: Date.now() },
            });
          } else {
            await metricsStore.updateTabMetrics(tabId, metrics, {
              status: 200,
              date: Date.now(),
            });
          }

          await this.refreshRecord();
        }
      } catch (e) {
        console.error("Failed to collect tab metrics", e);
      } finally {
        this.setState({ isLoading: false });
      }
    });
  };

  refreshRecord = async () => {
    const record = await metricsStore.findDailyRecord();
    this.setState({ record });
  };

  handleExport = async () => {
    const records = await metricsStore.getAllDays();
    exportToCSV(records);
  };

  render() {
    const { view, record, preferences, isLoading } = this.state;

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

        {view === "day" && (
          <DayView record={record} onRefresh={this.handleTabMetrics} isLoading={isLoading} />
        )}
        {view === "preferences" && (
          <PreferencesView preferences={preferences} onSave={this.savePreferences} />
        )}

        {view === "day" && (
          <button
            className="w-full p-2 rounded-md cursor-pointer text-white bg-green-500 hover:bg-green-700 text-sm"
            onClick={this.handleExport}
          >
            📥 Exporter CSV
          </button>
        )}
      </div>
    );
  }
}
