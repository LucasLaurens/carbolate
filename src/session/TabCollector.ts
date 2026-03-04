import EntriesValidator from "../performance/EntriesValidator";
import type { EntriesEnum } from "../performance/enums/EntriesEnum";
import { StrategyContext } from "../performance/StrategyContext";
import ResourceStrategy from "../performance/ResourceStrategy";
import type { Metrics } from "./types";

export class TabCollector {
  async collect(tabId: number): Promise<Metrics | null> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: "entries" },
        (response?: Record<EntriesEnum, PerformanceEntry[]>) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }

          const validator = new EntriesValidator(response ?? {});
          if (!validator.validate()) {
            resolve(null);
            return;
          }

          const resource = (response as Record<EntriesEnum, PerformanceResourceTiming[]>).resource;
          const navigation = (response as Record<EntriesEnum, PerformanceEntry[]>).navigation;

          const strategyContext = new StrategyContext(new ResourceStrategy());
          const { resourceCount, totalTransferSize } = strategyContext.execute(resource);

          resolve({
            requestCount: resourceCount,
            totalResourceSize: totalTransferSize / (1024 * 1024),
            cpuTimeToLoad: navigation?.[0]?.duration ? navigation[0].duration / 1000 : 0,
          });
        },
      );
    });
  }
}
