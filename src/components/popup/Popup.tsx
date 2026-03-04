import { Component } from "react";
import { metricsStore } from "../../session/store";
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

export default class Popup extends Component<Record<string, never>, State> {
  state: State = {
    view: "day",
    record: null,
    preferences: { ...DEFAULT_PREFERENCES },
    isLoading: false,
  };

  componentDidMount(): void {
    this.loadPreferences();
    this.handleRefresh();
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

  handleRefresh = async () => {
    if (this.state.isLoading) return;
    this.setState({ isLoading: true });
    try {
      const record = await metricsStore.findDailyRecord();
      this.setState({ record });
    } catch (e) {
      console.error("Failed to load record", e);
    } finally {
      this.setState({ isLoading: false });
    }
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
            📊 Aujourd hui
          </button>
          <button
            className={`flex-1 py-1 px-2 text-sm font-medium cursor-pointer ${view === "preferences" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => this.setState({ view: "preferences" })}
          >
            ⚙️ Préférences
          </button>
        </div>

        {view === "day" && (
          <DayView record={record} onRefresh={this.handleRefresh} isLoading={isLoading} />
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
