import { Component } from "react";
import { RETENTION_OPTIONS } from "../../config/retention";
import type { RetentionOption } from "../../config/retention";
import type { Preferences } from "../../config/types";
import type { Language, Translations } from "../../i18n/types";

export type { Preferences };

type Props = {
  preferences: Preferences;
  onSave: (prefs: Preferences) => void;
  t: Translations;
};

type State = { saved: boolean };

const CHOICE_BASE =
  "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border-2 cursor-pointer transition-all";
const CHOICE_SELECTED = "bg-green-50 text-green-700 border-green-500";
const CHOICE_IDLE = "bg-white text-stone-600 border-stone-200 hover:border-stone-300";

const choiceClass = (selected: boolean): string =>
  `${CHOICE_BASE} ${selected ? CHOICE_SELECTED : CHOICE_IDLE}`;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
      {children}
    </span>
  );
}

/**
 * What the panel says about its own figure — collapsed by default.
 *
 * It exists because the perimeter lived only in the docs: the UI said "Estimated
 * CO₂" and nothing more, so a user could not learn that the figure is a floor.
 * "Estimated" says *approximate*; it does not say *systematically below*.
 *
 * `<details>` rather than a disclosure component: no state to hold, no library, and
 * collapsed it costs the panel a single line — which is what a 320px panel can
 * afford for prose.
 */
function MethodDisclosure({ t }: { t: Translations }) {
  return (
    <details className="group">
      <summary className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest cursor-pointer list-none marker:content-none hover:text-stone-600">
        <span className="inline-block mr-1 transition-transform group-open:rotate-90">&#9656;</span>
        {t.settings.method.summary}
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-stone-500">
        <p>{t.settings.method.measurement}</p>
        <p>{t.settings.method.perimeter}</p>
      </div>
    </details>
  );
}

/**
 * Every control reads `props.preferences` and reports the whole next `Preferences`
 * upward — it holds no copy of them. A local copy would show the new window even
 * when the owner refuses the change, and refusing is exactly what the shrink
 * confirmation does.
 */
export default class SettingsView extends Component<Props, State> {
  state: State = { saved: false };

  private save(prefs: Preferences): void {
    this.setState({ saved: true });
    this.props.onSave(prefs);
    setTimeout(() => this.setState({ saved: false }), 1500);
  }

  handleLanguageChange = (language: Language) => this.save({ ...this.props.preferences, language });

  handleRetentionChange = (retentionDays: RetentionOption) =>
    this.save({ ...this.props.preferences, retentionDays });

  handleAutoExportToggle = () =>
    this.save({
      ...this.props.preferences,
      autoExportBeforeReset: !this.props.preferences.autoExportBeforeReset,
    });

  render() {
    const { t, preferences } = this.props;
    const { saved } = this.state;

    return (
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>{t.settings.language}</SectionLabel>
            {saved && (
              <span className="text-xs font-medium text-green-600">{t.settings.saved}</span>
            )}
          </div>
          <div className="flex gap-2">
            {(["en", "fr"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => this.handleLanguageChange(lang)}
                className={choiceClass(preferences.language === lang)}
              >
                {lang === "en" ? "🇬🇧 English" : "🇫🇷 Français"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3">
            <SectionLabel>{t.settings.retention.label}</SectionLabel>
          </div>
          <div className="flex gap-2">
            {RETENTION_OPTIONS.map((days) => (
              <button
                key={days}
                onClick={() => this.handleRetentionChange(days)}
                className={choiceClass(preferences.retentionDays === days)}
              >
                {t.settings.retention.options[days]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start justify-between gap-3 cursor-pointer">
          <span className="flex flex-col gap-1">
            <SectionLabel>{t.settings.autoExport.label}</SectionLabel>
            <span className="text-xs leading-relaxed text-stone-500">
              {t.settings.autoExport.hint}
            </span>
          </span>
          <input
            type="checkbox"
            checked={preferences.autoExportBeforeReset}
            onChange={this.handleAutoExportToggle}
            className="mt-0.5 h-4 w-4 shrink-0 accent-green-600 cursor-pointer"
          />
        </label>

        <MethodDisclosure t={t} />
      </div>
    );
  }
}
