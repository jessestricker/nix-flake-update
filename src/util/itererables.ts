type Transform<Input, Output> = (input: Input) => Output;

export function transformValues<Key, InputValue, OutputValue>(
  inputMap: Map<Key, InputValue>,
  valueTransform: Transform<InputValue, OutputValue>
): Map<Key, OutputValue> {
  function pairTransform([key, inputValue]: [Key, InputValue]): [
    Key,
    OutputValue
  ] {
    const outputValue = valueTransform(inputValue);
    return [key, outputValue];
  }

  const inputPairs = Array.from(inputMap);
  const outputPairs = inputPairs.map(pairTransform);
  const mappedMap = new Map(outputPairs);
  return mappedMap;
}
