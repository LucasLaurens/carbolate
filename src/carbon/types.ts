export type CarbonInput = {
  transferSize: number; // bytes
  cpuTime: number; // milliseconds
};

export type CarbonEstimate = {
  networkCo2: number;
  cpuCo2: number;
  renderingCo2: number;
  totalCo2: number;
};

export type ContributionMetric = keyof Omit<CarbonEstimate, "totalCo2">;

export interface FootprintCalculator<Input, Output> {
  calculate(inputs: Input[]): Output;
}
