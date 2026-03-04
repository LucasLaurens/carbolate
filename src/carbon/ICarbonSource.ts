import type { CarbonInput } from "./types";

export interface ICarbonSource {
  calculate(inputs: CarbonInput[]): number;
}
