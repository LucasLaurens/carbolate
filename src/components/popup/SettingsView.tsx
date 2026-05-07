import { Component } from "react";
import type { Preferences } from "../../config/types";
import type { Language, Translations } from "../../i18n/types";

export type { Preferences };

type Props = {
  preferences: Preferences;
  onSave: (prefs: Preferences) => void;
  t: Translations;
};

type State = { prefs: Preferences; saved: boolean };

export default class SettingsView extends Component<Props, State> {
  state: State = { prefs: { ...this.props.preferences }, saved: false };

  handleLanguageChange = (lang: Language) => {
    const newPrefs = { ...this.state.prefs, language: lang };
    this.setState({ prefs: newPrefs, saved: true });
    this.props.onSave(newPrefs);
    setTimeout(() => this.setState({ saved: false }), 1500);
  };

  render() {
    const { t } = this.props;
    const { prefs, saved } = this.state;

    return (
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
              {t.settings.language}
            </span>
            {saved && (
              <span className="text-xs font-medium text-green-600">{t.settings.saved}</span>
            )}
          </div>
          <div className="flex gap-2">
            {(["en", "fr"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => this.handleLanguageChange(lang)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border-2 cursor-pointer transition-all ${
                  prefs.language === lang
                    ? "bg-green-50 text-green-700 border-green-500"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                }`}
              >
                {lang === "en" ? "🇬🇧 English" : "🇫🇷 Français"}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
}
