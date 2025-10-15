import { Component } from "react";
import EntriesValidator from "../../validators/EntriesValidator";
import { EntriesEnum } from "../../enums/EntriesEnum";
import { StrategyContext } from "../../strategy/StrategyContext";
import ResourceStrategy from "../../strategy/ResourceStrategy";
import { Metrics, useMetricsStore } from "../../store";

type State = {
  tabId: number;
  metrics: Metrics
}

export default class Popup extends Component<{}, State> {
  unsubscribe?: () => void;

  state: State = {
    tabId: 0,
    metrics: {
      requestCount: 0,
      totalResourceSize: 0,
      cpuTimeToLoad: 0,
    },
  };

  componentDidMount() {
    this.unsubscribe = useMetricsStore.subscribe((state) => {
      const currentTab = state.tabs.find(tab => tab.id === this.state.tabId);
      if (currentTab) {
        this.setState({ metrics: currentTab.metrics });
      }
    });

    this.handle();
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  handle = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      tabs.forEach((currentTab: chrome.tabs.Tab) => {
        if (!currentTab.id) {
          console.info("This tab does not contain any id");
          return;
        }

        this.setState({ tabId: currentTab.id });

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

            const store = useMetricsStore.getState();
            const existingTab = store.tabs.find(tab => tab.id === currentTab.id);

            if (!existingTab) {
              console.debug('before adding tab', store.totalMetrics)
              store.addTab({
                id: currentTab.id!,
                metrics: newMetrics,
                meta: { status: 200, date: Date.now() },
              });
              console.debug('after adding tab', store.totalMetrics)
              return
            }

            console.debug('before updating metrics', store.totalMetrics)
            store.updateTabMetrics(currentTab.id!, newMetrics);
            console.debug('after updating metrics', store.totalMetrics)
          }
        );
      });
    });
  };

  render() {
    const { metrics } = this.state;
    const { totalMetrics } = useMetricsStore.getState()

    console.debug('store and state metrics', metrics, totalMetrics)

    return (
      <div className="p-5 w-100 flex flex-col gap-4 items-center justify-center">
        <ul>
          <li>📦 Total resource size: {metrics.totalResourceSize.toFixed(2)}MB</li>
          <li>🔗 Number of requests: {metrics.requestCount}</li>
          <li>⏱ Estimated CPU time: {metrics.cpuTimeToLoad.toFixed(2)}s</li>
        </ul>

        <button
          className="w-fit p-2 text-center rounded-md cursor-pointer text-white bg-blue-500 hover:bg-blue-700"
          onClick={this.handle}
        >
          🔄 Refresh Data
        </button>
      </div>
    );
  }
}
