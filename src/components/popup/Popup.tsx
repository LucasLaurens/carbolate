import { Component } from "react";
import EntriesValidator from "../../validators/EntriesValidator";
import { EntriesEnum } from "../../enums/EntriesEnum";
import { StrategyContext } from "../../strategy/StrategyContext";
import ResourceStrategy from "../../strategy/ResourceStrategy";
import { Metrics, metricsStore } from "../../store";

type State = { metrics: Metrics }

export default class Popup extends Component<{}, State> {
  state: State = {
    metrics: {
      requestCount: 0,
      totalResourceSize: 0,
      cpuTimeToLoad: 0,
    },
  };

  handleTabMetrics = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      tabs.forEach((currentTab: chrome.tabs.Tab) => {
        if (!currentTab.id) {
          console.info("This tab does not contain any id");
          return;
        }

        chrome.tabs.sendMessage(
          currentTab.id,
          { type: "entries" },
          (response?: Record<string, any>) => {
            const validator = new EntriesValidator(response ?? {});
            if (!validator.validate()) {
              console.log(validator.message());
              return;
            }

            const resource = (response as Record<EntriesEnum, any[]>).resource;
            const navigation = (response as Record<EntriesEnum, any[]>).navigation;

            const strategyContext = new StrategyContext(new ResourceStrategy());
            const { resourceCount, totalTransferSize } = strategyContext.execute(resource);

            const newMetrics = {
              requestCount: resourceCount,
              totalResourceSize: totalTransferSize / (1024 * 1024),
              cpuTimeToLoad: navigation?.[0]?.duration
                ? navigation[0].duration / 1000
                : 0,
            };

            if (!metricsStore.hasExistingTabById(currentTab.id!)) {
              metricsStore.addTab({
                id: currentTab.id!,
                metrics: newMetrics,
                meta: { status: 200, date: Date.now() }
              });
            } else {
              // todo: update status and date too
              metricsStore.updateTabMetrics(currentTab.id!, newMetrics);
            }

            metricsStore.getTotalMetrics()
              .then((metrics: Metrics) => this.setState({ metrics: metrics }))
              .catch((error) => console.warn("Unable to update the current metrics state", error))
          }
        );
      });
    });
  };

  componentDidMount(): void {
    this.handleTabMetrics()
  }

  render() {
    const { metrics } = this.state;

    return (
      <div className="p-5 w-100 flex flex-col gap-4 items-center justify-center">
        <ul>
          <li>📦 Total resource size: {metrics.totalResourceSize.toFixed(2)}MB</li>
          <li>🔗 Number of requests: {metrics.requestCount}</li>
          <li>⏱ Estimated CPU time: {metrics.cpuTimeToLoad.toFixed(2)}s</li>
        </ul>

        <button
          className="w-fit p-2 text-center rounded-md cursor-pointer text-white bg-blue-500 hover:bg-blue-700"
          onClick={this.handleTabMetrics}
        >
          🔄 Refresh Data
        </button>
      </div>
    );
  }
}
