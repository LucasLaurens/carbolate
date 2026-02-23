import type Strategy from "./contracts/Strategy";

export class StrategyContext<Input, Output> {
  private strategy: Strategy<Input, Output>;

  constructor(strategy: Strategy<Input, Output>) {
    this.strategy = strategy;
  }

  public setStrategy(strategy: Strategy<Input, Output>) {
    this.strategy = strategy;
  }

  public execute(input: Input[]): Output {
    return this.strategy.handle(input);
  }
}
