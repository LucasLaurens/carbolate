import CarbonCalculator from "../src/carbon/CarbonCalculator";
import { toCarbonInput } from "../src/carbon/toCarbonInput";
import type { Metrics, MetricTab } from "../src/session/types";

const calculator = new CarbonCalculator();

export const computeCarbon = (m: Metrics) => calculator.calculate([toCarbonInput(m)]);

export const withCarbon = <T extends Omit<MetricTab, "carbon">>(
  tab: T,
): T & Pick<MetricTab, "carbon"> => ({
  ...tab,
  carbon: computeCarbon(tab.metrics),
});
