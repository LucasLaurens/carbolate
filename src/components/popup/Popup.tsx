import { Component } from "react";
import EntriesValidator from "../../validators/EntriesValidator";

export default class Popup extends Component {
  handle = () => {
    // Envoie un message au content script de l'onglet actif
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "getEntries" }, (response) => {
          const validator = new EntriesValidator(response.entries)
          if (!validator.validate()) {
            alert(validator.message())
            return
          }

          console.log("Entries reçues depuis la page :", response.entries);
        });
      }
    });
  };

  render() {
    return (
      <div style={{ padding: "10px", fontFamily: "sans-serif" }}>
        <h1>Carbolate 👋</h1>
        <p>Calculate your carbon footprint on the web.</p>
        <button onClick={this.handle}>
          déclancher l'evenement
        </button>
      </div>
    );
  }
}