import CarbonCalculator from "../src/carbon/CarbonCalculator";
import type { CarbonInput } from "../src/carbon/types";
import type { Metrics, MetricTab } from "../src/session/types";

const calculator = new CarbonCalculator();

export const toCarbonInput = (m: Metrics): CarbonInput => ({
  transferSize: m.totalResourceSize * 1024 * 1024, // MiB → bytes
  cpuTime: m.cpuTimeToLoad * 1000, // s → ms
});

export const computeCarbon = (m: Metrics) => calculator.calculate([toCarbonInput(m)]);

export const withCarbon = <T extends Omit<MetricTab, "carbon">>(tab: T): T & Pick<MetricTab, "carbon"> => ({
  ...tab,
  carbon: computeCarbon(tab.metrics),
});
