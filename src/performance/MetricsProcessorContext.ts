import type MetricsExtractor from "./contracts/MetricsExtractor";

export class MetricsProcessorContext<Input, Output> {
  private extractor: MetricsExtractor<Input, Output>;

  constructor(extractor: MetricsExtractor<Input, Output>) {
    this.extractor = extractor;
  }

  public setExtractor(extractor: MetricsExtractor<Input, Output>) {
    this.extractor = extractor;
  }

  public execute(input: Input[]): Output {
    return this.extractor.handle(input);
  }
}
