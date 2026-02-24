import type Resource from "./contracts/Resource";
import type Strategy from "./contracts/Strategy";

type ResourceStrategyOutput = {
  resourceCount: number;
  totalTransferSize: number;
};

export default class ResourceStrategy implements Strategy<Resource, ResourceStrategyOutput> {
  handle(resource: Resource[]): ResourceStrategyOutput {
    const resourceCount = resource.length;
    // Sum of transferred sizes (actual network bytes)
    const totalTransferSize = resource.reduce(
      (carry: number, item: Resource) => carry + item.transferSize,
      0,
    );
    return {
      resourceCount,
      totalTransferSize,
    };
  }
}
