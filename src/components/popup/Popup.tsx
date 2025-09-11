import { Component } from "react";

export default class Popup extends Component {
  handle = () => {
    console.log("handle");

    // Envoie un message au content script de l'onglet actif
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "getEntries" }, (response) => {
          console.log("Entries reçues depuis la page :", response.entries);
        });
      }
    });

    // document.addEventListener("entries", (event) => {
    //   const customEvent = event as CustomEvent<PerformanceEntry[]>;
    //   console.log("Entries reçues :", customEvent.detail);
    // });
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