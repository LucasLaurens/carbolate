import { Component } from "react";
import { RETENTION_OPTIONS } from "../../config/retention";
import type { RetentionOption } from "../../config/retention";
import type { Preferences } from "../../config/types";
import type { Language, Translations } from "../../i18n/types";

export type { Preferences };

type Props = {
  preferences: Preferences;
  /** Resolves false when the change was refused or failed: nothing is confirmed then. */
  onSave: (prefs: Preferences) => Promise<boolean>;
  t: Translations;
};

type State = { saved: boolean };

const SAVED_NOTICE_MS = 1500;

/**
 * Weight differs between the two states, not only hue: the selection must read
 * in greyscale. Each weight lives in its state, never in the base, because two
 * classes of the same property resolve in stylesheet order, not in class order.
 */
const CHOICE_BASE =
  "flex-1 py-2.5 px-3 rounded-xl text-sm border-2 cursor-pointer transition-colors";
const CHOICE_SELECTED = "font-semibold bg-green-50 text-green-800 border-green-600";
const CHOICE_IDLE = "font-medium bg-white text-stone-600 border-stone-200 hover:border-stone-400";

/** Endonyms: a language is named in itself, and a flag names a country, not a language. */
const LANGUAGE_NAMES: Record<Language, string> = { en: "English", fr: "Français" };

const buildChoiceClass = (selected: boolean): string =>
  `${CHOICE_BASE} ${selected ? CHOICE_SELECTED : CHOICE_IDLE}`;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
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
      <summary className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest cursor-pointer list-none marker:content-none hover:text-stone-700">
        <span
          aria-hidden="true"
          className="inline-block mr-1 transition-transform motion-reduce:transition-none group-open:rotate-90"
        >
          &#9656;
        </span>
        {t.settings.method.summary}
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-stone-600">
        <p>{t.settings.method.measurement}</p>
        <p>{t.settings.method.perimeter}</p>
        <p>{t.settings.method.allocation}</p>
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
  private savedTimer: ReturnType<typeof setTimeout> | undefined;

  componentWillUnmount(): void {
    clearTimeout(this.savedTimer);
  }

  private async save(prefs: Preferences): Promise<void> {
    if (!(await this.props.onSave(prefs))) return;
    clearTimeout(this.savedTimer);
    this.setState({ saved: true });
    this.savedTimer = setTimeout(() => this.setState({ saved: false }), SAVED_NOTICE_MS);
  }

  changeLanguage = (language: Language) => void this.save({ ...this.props.preferences, language });

  changeRetention = (retentionDays: RetentionOption) =>
    void this.save({ ...this.props.preferences, retentionDays });

  toggleAutoExport = () =>
    void this.save({
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
            <span role="status" className="text-xs font-medium text-green-700">
              {saved ? t.settings.saved : ""}
            </span>
          </div>
          <div role="group" aria-label={t.settings.language} className="flex gap-2">
            {(Object.keys(LANGUAGE_NAMES) as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                lang={lang}
                aria-pressed={preferences.language === lang}
                onClick={() => this.changeLanguage(lang)}
                className={buildChoiceClass(preferences.language === lang)}
              >
                {LANGUAGE_NAMES[lang]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3">
            <SectionLabel>{t.settings.retention.label}</SectionLabel>
          </div>
          <div role="group" aria-label={t.settings.retention.label} className="flex gap-2">
            {RETENTION_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={preferences.retentionDays === days}
                onClick={() => this.changeRetention(days)}
                className={buildChoiceClass(preferences.retentionDays === days)}
              >
                {t.settings.retention.options[days]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start justify-between gap-3 cursor-pointer">
          <span className="flex flex-col gap-1">
            <SectionLabel>{t.settings.autoExport.label}</SectionLabel>
            <span className="text-xs leading-relaxed text-stone-600">
              {t.settings.autoExport.hint}
            </span>
          </span>
          <input
            type="checkbox"
            checked={preferences.autoExportBeforeReset}
            onChange={this.toggleAutoExport}
            className="mt-0.5 h-4 w-4 shrink-0 accent-green-600 cursor-pointer"
          />
        </label>

        <MethodDisclosure t={t} />
      </div>
    );
  }
}
