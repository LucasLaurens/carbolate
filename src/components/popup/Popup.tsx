import { Component } from "react";
import EntriesValidator from "../../validators/EntriesValidator";
import { EntriesEnum } from "../../enums/EntriesEnum";

interface PopupState {
  requestCount: number;
}

export default class Popup extends Component<{}, PopupState> {
  state: PopupState = {
    requestCount: 0,
  };

  handle = () => {
    // Envoie un message au content script de l'onglet actif
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "entries" },
          (response?: Record<string, any>) => {
            console.log('entries type response', response)
            const validator = new EntriesValidator(
              response ?? {} // todo: response could contains an empty object
            )
            if (!validator.validate()) {
              alert(validator.message())
              return
            }

            // todo: create an enum for initiatorType (e.g. fetch)
            // todo: manage every entry type by strategy pattern class
            const resourceCount = (response as Record<EntriesEnum, any[]>).resource.length

            this.setState({ requestCount: resourceCount });
          }
        );
      }
    });
  };

  render() {
    const { requestCount } = this.state;

    return (
      <div className="p-5 w-100 flex flex-col gap-4 items-center justify-center">
        <ul>
          <li>📦 Total resource size: 2.4 MB</li>
          <li>🔗 Number of requests: {requestCount}</li>
          <li>⏱ Estimated CPU time: 1.8 s</li>
          <li>⚡ Energy consumed: 0.0018 Wh</li>
          <li>🌍 CO₂ emissions: 0.0007 gCO₂</li>
        </ul>
        <button
          className="w-fit p-2 text-center rounded-md cursor-pointer text-white bg-blue-500 hover:bg-blue-700"
          onClick={this.handle}
        >🔄 Refresh Data</button>
      </div>
    );
  }
}