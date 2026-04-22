import { Component } from "react";
import { metricsStore } from "../../session/store";
import { ChromeStorage } from "../../storage/ChromeStorage";
import { DEFAULT_PREFERENCES } from "../../config/preferences";
import type { Preferences } from "../../config/types";
import type { DailyRecord } from "../../session/types";
import { exportToCSV } from "../../utils/csv";
import { RateLimiter } from "../../security/RateLimiter";
import DayView from "./DayView";
import SettingsView from "./SettingsView";

type View = "day" | "settings";

type State = {
  view: View;
  record: DailyRecord | null;
  preferences: Preferences;
  isLoading: boolean;
};

export default class Popup extends Component<Record<string, never>, State> {
  private rateLimiter = new RateLimiter();

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
    if (!this.rateLimiter.isAllowed("save-preferences")) return;
    try {
      await ChromeStorage.setPreferences(prefs);
      this.setState({ preferences: prefs });
    } catch (e) {
      console.error("Failed to save preferences", e);
    }
  };

  handleRefresh = async () => {
    if (!this.rateLimiter.isAllowed("refresh")) return;
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
    if (!this.rateLimiter.isAllowed("csv-export")) return;
    const records = await metricsStore.getAllDays();
    exportToCSV(records);
  };

  render() {
    const { view, record, preferences, isLoading } = this.state;

    return (
      <div className="w-80 p-4 flex flex-col gap-3">
        <div className="flex gap-1 border-b border-gray-200 pb-2">📊 Today</div>

        {view === "day" && (
          <DayView record={record} onRefresh={this.handleRefresh} isLoading={isLoading} />
        )}
        {view === "settings" && (
          <SettingsView preferences={preferences} onSave={this.savePreferences} />
        )}
      </div>
    );
  }
}
