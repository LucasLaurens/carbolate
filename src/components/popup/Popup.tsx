import { Component } from "react";
import { DEFAULT_PREFERENCES } from "../../config/preferences";
import { isKept } from "../../config/retention";
import { getTranslations } from "../../i18n";
import type { Translations } from "../../i18n/types";
import type { Preferences } from "../../config/types";
import { createEmptyDailyRecord } from "../../session/aggregator";
import type { DailyRecord, DailyRecordReader } from "../../session/types";
import type { PreferencesStorage } from "../../storage/types";
import type { Clock } from "../../utils/clock";
import { exportToCSV } from "../../utils/csv";
import { RateLimiter } from "../../security/RateLimiter";
import { StorageKey } from "../../storage/StorageKey";
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
  days: readonly DailyRecord[];
  preferences: Preferences;
  /** False until the first read lands; later reads refresh in place, undimmed. */
  hasLoaded: boolean;
  isExporting: boolean;
  exportFailed: boolean;
};

export default class Popup extends Component<Props, State> {
  private readonly rateLimiter = new RateLimiter(this.props.clock);
  private isReading = false;

  state: State = {
    view: "day",
    record: createEmptyDailyRecord(this.props.clock.readDailyDate()),
    days: [],
    preferences: { ...DEFAULT_PREFERENCES },
    hasLoaded: false,
    isExporting: false,
    exportFailed: false,
  };

  componentDidMount(): void {
    this.loadPreferences();
    this.readRecords();
    chrome.storage.onChanged.addListener(this.onStorageChanged);
  }

  /** The panel's language can change at runtime; `index.html` only carries the default. */
  componentDidUpdate(): void {
    document.documentElement.lang = this.state.preferences.language;
  }

  componentWillUnmount(): void {
    chrome.storage.onChanged.removeListener(this.onStorageChanged);
  }

  /**
   * The panel follows storage instead of being refreshed by hand: a living visit
   * writes every few seconds while the user keeps browsing, and a snapshot taken
   * at open would be stale before it was read. Preferences are ignored here —
   * the panel is the only writer of those, and it already holds them.
   */
  private readonly onStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== "local") return;
    if (changes[StorageKey.SESSIONS] === undefined) return;
    void this.readRecords();
  };

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

  /** Resolves true only once the preferences are written, so the view never confirms a refusal. */
  savePreferences = async (preferences: Preferences): Promise<boolean> => {
    if (!this.rateLimiter.isAllowed("save-preferences")) return false;
    try {
      if (!(await this.allowsRetentionLoss(preferences))) return false;
      await this.props.storage.setPreferences(preferences);
      this.setState({ preferences });
      return true;
    } catch (e) {
      console.error("Failed to save preferences", e);
      return false;
    }
  };

  /**
   * The guard is a field, not state: `setState` is asynchronous, so two storage
   * events in the same tick would both have read `false` and both have fetched.
   */
  readRecords = async () => {
    if (this.isReading) return;
    this.isReading = true;
    try {
      const [record, days] = await Promise.all([
        this.props.store.getDailyRecord(),
        this.props.store.getAllDays(),
      ]);
      this.setState({ record, days });
    } catch (e) {
      console.error("Failed to load record", e);
    } finally {
      this.isReading = false;
      this.setState({ hasLoaded: true });
    }
  };

  exportRecords = async () => {
    if (this.state.isExporting) return;
    if (!this.rateLimiter.isAllowed("csv-export")) return;
    this.setState({ isExporting: true, exportFailed: false });
    try {
      const records = await this.props.store.getAllDays();
      await exportToCSV(records, this.props.clock);
    } catch (e) {
      console.error("Failed to export CSV", e);
      this.setState({ exportFailed: true });
    } finally {
      this.setState({ isExporting: false });
    }
  };

  setView = (view: View) => this.setState({ view });

  render() {
    const { view, record, days, preferences, hasLoaded, isExporting, exportFailed } = this.state;
    const t = getTranslations(preferences.language);

    return (
      <div className="w-80 flex flex-col bg-stone-50 text-stone-800">
        <header className="bg-white border-b border-stone-200">
          <div className="px-4 pt-4 pb-0">
            <h1 className="flex items-center gap-1.5 mb-3 text-xs font-bold text-stone-600 uppercase tracking-widest">
              <img src="/assets/icons/icon-32.png" alt="" width={16} height={16} />
              Carbolate
            </h1>
            <nav className="flex -mb-px">
              {NAV_ORDER.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => this.setView(v)}
                  aria-current={view === v ? "page" : undefined}
                  className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest border-b-2 transition-colors cursor-pointer ${
                    view === v
                      ? "border-green-600 text-green-700"
                      : "border-transparent text-stone-500 hover:text-stone-700"
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
              days={days}
              today={this.props.clock.now()}
              language={preferences.language}
              onExport={this.exportRecords}
              isLoading={!hasLoaded}
              isExporting={isExporting}
              exportFailed={exportFailed}
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
            className="text-[11px] text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
          >
            {PRIVACY_CONTACT}
          </a>
        </footer>
      </div>
    );
  }
}
