import { Component } from "react";
import { DEFAULT_PREFERENCES } from "../../config/preferences";
import { isKept } from "../../config/retention";
import { getTranslations } from "../../i18n";
import type { Translations } from "../../i18n/types";
import type { Preferences } from "../../config/types";
import { emptyDailyRecord } from "../../session/aggregator";
import type { DailyRecord, DailyRecordReader } from "../../session/types";
import type { PreferencesStorage } from "../../storage/types";
import type { Clock } from "../../utils/clock";
import { exportToCSV } from "../../utils/csv";
import { RateLimiter } from "../../security/RateLimiter";
import DayView from "./DayView";
import PrivacyView from "./PrivacyView";
import SettingsView from "./SettingsView";
import { PRIVACY_CONTACT } from "../../legal/privacy";

type View = "day" | "settings" | "privacy";

const NAV_ORDER: View[] = ["day", "settings", "privacy"];

/** Keyed by view so a new tab cannot be added without giving it a label. */
const NAV_LABEL_KEY: Record<View, keyof Translations["nav"]> = {
  day: "today",
  settings: "settings",
  privacy: "privacy",
};

type Props = {
  /** Read-only on measurements: the panel never writes a metric. */
  store: DailyRecordReader;
  storage: PreferencesStorage;
  clock: Clock;
};

type State = {
  view: View;
  record: DailyRecord;
  preferences: Preferences;
  isLoading: boolean;
};

export default class Popup extends Component<Props, State> {
  private readonly rateLimiter = new RateLimiter(this.props.clock);

  state: State = {
    view: "day",
    record: emptyDailyRecord(this.props.clock.dailyDate()),
    preferences: { ...DEFAULT_PREFERENCES },
    isLoading: false,
  };

  componentDidMount(): void {
    this.loadPreferences();
    this.handleRefresh();
  }

  loadPreferences = async () => {
    try {
      const preferences = await this.props.storage.getPreferences();
      this.setState({ preferences });
    } catch (e) {
      console.error("Failed to load preferences", e);
    }
  };

  /**
   * The panel cannot delete a day — its store is read-only on measurements, and
   * the background owns the reset cycle. What it owns is the warning: it is the
   * only context with a user to ask, and shrinking the window is the one action
   * in the product that destroys recorded data.
   *
   * O(n) time, O(1) space — n = stored days.
   */
  private async allowsRetentionLoss(next: Preferences): Promise<boolean> {
    const { preferences } = this.state;
    if (next.retentionDays === preferences.retentionDays) return true;

    const today = this.props.clock.now();
    const records = await this.props.store.getAllDays();
    const dropped = records.filter(
      (record) => !isKept(record.date, next.retentionDays, today),
    ).length;
    if (dropped === 0) return true;

    const t = getTranslations(preferences.language);
    const warning = next.autoExportBeforeReset
      ? t.settings.retention.confirmWithExport(dropped)
      : t.settings.retention.confirm(dropped);
    return window.confirm(warning);
  }

  savePreferences = async (preferences: Preferences) => {
    if (!this.rateLimiter.isAllowed("save-preferences")) return;
    try {
      if (!(await this.allowsRetentionLoss(preferences))) return;
      await this.props.storage.setPreferences(preferences);
      this.setState({ preferences });
    } catch (e) {
      console.error("Failed to save preferences", e);
    }
  };

  handleRefresh = async () => {
    if (!this.rateLimiter.isAllowed("refresh")) return;
    if (this.state.isLoading) return;
    this.setState({ isLoading: true });
    try {
      const record = await this.props.store.getDailyRecord();
      this.setState({ record });
    } catch (e) {
      console.error("Failed to load record", e);
    } finally {
      this.setState({ isLoading: false });
    }
  };

  handleExport = async () => {
    if (!this.rateLimiter.isAllowed("csv-export")) return;
    const records = await this.props.store.getAllDays();
    try {
      await exportToCSV(records, this.props.clock);
    } catch (e) {
      console.error("Failed to export CSV", e);
    }
  };

  setView = (view: View) => this.setState({ view });

  render() {
    const { view, record, preferences, isLoading } = this.state;
    const t = getTranslations(preferences.language);

    return (
      <div className="w-80 flex flex-col bg-stone-50 text-stone-800">
        <header className="bg-white border-b border-stone-200">
          <div className="px-4 pt-4 pb-0">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-base leading-none">🌿</span>
              <span className="text-xs font-bold text-stone-600 uppercase tracking-widest">
                Carbolate
              </span>
            </div>
            <nav className="flex -mb-px">
              {NAV_ORDER.map((v) => (
                <button
                  key={v}
                  onClick={() => this.setView(v)}
                  className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest border-b-2 transition-colors cursor-pointer ${
                    view === v
                      ? "border-green-600 text-green-700"
                      : "border-transparent text-stone-400 hover:text-stone-600"
                  }`}
                >
                  {t.nav[NAV_LABEL_KEY[v]]}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="p-4 flex flex-col gap-3">
          {view === "day" && (
            <DayView
              record={record}
              onRefresh={this.handleRefresh}
              onExport={this.handleExport}
              isLoading={isLoading}
              t={t}
            />
          )}
          {view === "settings" && (
            <SettingsView preferences={preferences} onSave={this.savePreferences} t={t} />
          )}
          {view === "privacy" && <PrivacyView language={preferences.language} />}
        </main>

        <footer className="px-4 pb-3 text-center">
          <a
            href={`mailto:${PRIVACY_CONTACT}`}
            className="text-[9px] text-stone-400 hover:text-stone-600 transition-colors"
          >
            {PRIVACY_CONTACT}
          </a>
        </footer>
      </div>
    );
  }
}
