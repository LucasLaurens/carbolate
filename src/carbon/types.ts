export type CarbonInput = {
  transferSize: number; // bytes
  cpuTime: number; // milliseconds
};

export type CarbonEstimate = {
  networkCo2: number;
  cpuCo2: number;
  totalCo2: number;
};

export interface Carbon<Input, Output> {
  calculate(inputs: Input[]): Output;
}
