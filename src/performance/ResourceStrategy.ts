import Resource from "./contracts/Resource";
import Strategy from "./contracts/Strategy";

type ResourceStrategyOutput = {
    resourceCount: number;
    totalTransferSize: number;
}

export default class ResourceStrategy implements Strategy<Resource, ResourceStrategyOutput> {
    handle(resource: Resource[]): ResourceStrategyOutput {
        const resourceCount = resource.length
        // Somme des tailles transférées (réseau réel)
        const totalTransferSize = resource.reduce(
            (carry: number, item: any) => carry + item.transferSize,
            0
        );
        return {
            resourceCount,
            totalTransferSize
        }
    }
}
