import { Component } from "react";
import type { Preferences } from "../../config/preferences";

export type { Preferences };

type Props = {
  preferences: Preferences;
  onSave: (prefs: Preferences) => void;
};

type State = { prefs: Preferences; saved: boolean };

export default class SettingsView extends Component<Props, State> {
  state: State = { prefs: { ...this.props.preferences }, saved: false };

  handleChange = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    this.setState((prev) => ({ prefs: { ...prev.prefs, [key]: value }, saved: false }));
  };

  handleSave = () => {
    this.props.onSave(this.state.prefs);
    this.setState({ saved: true });
    setTimeout(() => this.setState({ saved: false }), 2000);
  };

  render() {
    const { saved } = this.state;

    return (
      <div className="flex flex-col gap-4">
        <div>
          {/* <label className="block text-sm font-medium text-gray-700 mb-1">Période de reset</label> */}
          {/* <div className="flex gap-2">
            <button
              className={`flex-1 p-2 rounded-md text-sm border cursor-pointer ${prefs.resetPeriod === "daily" ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}
              onClick={() => {
                this.handleChange("resetPeriod", "daily");
                this.handleChange("retentionDays", 1);
              }}
            >
              Quotidien <span className="text-xs opacity-70">(V1)</span>
            </button>
            <button
              className={`flex-1 p-2 rounded-md text-sm border cursor-pointer ${prefs.resetPeriod === "weekly" ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}
              onClick={() => {
                this.handleChange("resetPeriod", "weekly");
                this.handleChange("retentionDays", 7);
              }}
            >
              Hebdomadaire <span className="text-xs opacity-70">(V2)</span>
            </button>
          </div> */}
          {/* <p className="text-xs text-gray-400 mt-1">
            {prefs.resetPeriod === "daily"
              ? "Les données sont conservées pendant 1 jour puis nettoyées."
              : "Les données sont conservées pendant 7 jours puis nettoyées."}
          </p> */}
        </div>

        {/* <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Export auto avant reset</label>
            <p className="text-xs text-gray-400">Télécharger un CSV avant chaque nettoyage</p>
          </div>
          <button
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${prefs.autoExportBeforeReset ? "bg-blue-500" : "bg-gray-300"}`}
            onClick={() => this.handleChange("autoExportBeforeReset", !prefs.autoExportBeforeReset)}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${prefs.autoExportBeforeReset ? "left-7" : "left-1"}`}
            />
          </button>
        </div> */}

        <button
          className={`w-full p-2 rounded-md text-sm text-white cursor-pointer ${saved ? "bg-green-500" : "bg-blue-500 hover:bg-blue-700"}`}
          onClick={this.handleSave}
        >
          {saved ? "✅ Saved !" : "Save"}
        </button>
      </div>
    );
  }
}
