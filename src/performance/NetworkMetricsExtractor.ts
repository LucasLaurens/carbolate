import type NetworkResource from "./contracts/NetworkResource";
import type MetricsExtractor from "./contracts/MetricsExtractor";
import type { ExtractedMetrics } from "./types";

export default class NetworkMetricsExtractor implements MetricsExtractor<
  NetworkResource,
  ExtractedMetrics
> {
  handle(resources: NetworkResource[]): ExtractedMetrics {
    const resourceCount = resources.length;
    const totalTransferSize = resources.reduce(
      (acc: number, item: NetworkResource) => acc + item.transferSize,
      0,
    );
    return { resourceCount, totalTransferSize };
  }
}
