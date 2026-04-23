import { Component } from "react";
import { metricsStore } from "../../session/store";
import { ChromeStorage } from "../../storage/ChromeStorage";
import { DEFAULT_PREFERENCES } from "../../config/preferences";
import { getTranslations } from "../../i18n";
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

  setView = (view: View) => this.setState({ view });

  render() {
    const { view, record, preferences, isLoading } = this.state;
    const t = getTranslations(preferences.language);

    return (
      <div className="w-80 flex flex-col bg-white">
        <div className="px-4 pt-3 border-b border-gray-100">
          <div className="flex">
            {(["day", "settings"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => this.setView(v)}
                className={`flex-1 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                  view === v
                    ? "border-green-500 text-green-700"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {v === "day" ? `📊 ${t.nav.today}` : `⚙️ ${t.nav.settings}`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {view === "day" && (
            <DayView record={record} onRefresh={this.handleRefresh} isLoading={isLoading} t={t} />
          )}
          {view === "settings" && (
            <SettingsView preferences={preferences} onSave={this.savePreferences} t={t} />
          )}
        </div>
      </div>
    );
  }
}
