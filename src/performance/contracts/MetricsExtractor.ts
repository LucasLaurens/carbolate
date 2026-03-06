export default interface MetricsExtractor<Input, Output> {
  handle(input: Input[]): Output;
}
