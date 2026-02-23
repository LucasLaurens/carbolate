export default interface Strategy<Input, Output> {
  handle(input: Input[]): Output;
}
