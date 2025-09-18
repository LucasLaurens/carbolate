import { Component } from "react";
import EntriesValidator from "../../validators/EntriesValidator";
import { EntriesEnum } from "../../enums/EntriesEnum";
import { StrategyContext } from "../../strategy/StrategyContext";
import ResourceStrategy from "../../strategy/ResourceStrategy";

interface PopupState {
  requestCount: number;
  totalResourceSize: number;
  cpuTimeToLoad: number;
}

export default class Popup extends Component<{}, PopupState> {
  state: PopupState = {
    requestCount: 0,
    totalResourceSize: 0,
    cpuTimeToLoad: 0,
  };

    // 🔄
    componentDidMount() {
      this.handle()
    }

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
              // alert(validator.message())
              console.log(validator.message())
              return
            }

            // todo: create an enum for initiatorType (e.g. fetch)
            console.log('response', response)
            // todo: manage every entry type by strategy pattern class
            const resource = (response as Record<EntriesEnum, any[]>).resource;
            const navigation = (response as Record<EntriesEnum, any[]>).navigation

            const strategyContext = (new StrategyContext(new ResourceStrategy()))
            const {resourceCount, totalTransferSize} = strategyContext.execute(resource)

            this.setState({
              requestCount: resourceCount,
              totalResourceSize: (totalTransferSize / (1024 * 1024)),
              // todo: calculate with every entries durantion
              cpuTimeToLoad: navigation[0].duration / 1000
            });
          }
        );
      }
    });
  };

  render() {
    const {
      requestCount,
      totalResourceSize,
      cpuTimeToLoad
    } = this.state;

    return (
      <div className="p-5 w-100 flex flex-col gap-4 items-center justify-center">
        <ul>
          <li>📦 Total resource size: {totalResourceSize.toFixed(2)}MB</li>
          <li>🔗 Number of requests: {requestCount}</li>
          <li>⏱ Estimated CPU time: {cpuTimeToLoad.toFixed(2)}s</li>
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