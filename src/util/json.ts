import * as rt from "runtypes";

// compound json types

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonArray
  | JsonObject;
export type JsonArray = JsonValue[];
export type JsonObject = { [name: string]: JsonValue };

// compound json run-types

export const JsonValue: rt.Runtype<JsonValue> = rt.Lazy(() =>
  rt.Union(rt.Null, rt.Boolean, rt.Number, rt.String, JsonArray, JsonObject)
);
export const JsonArray = rt.Array(JsonValue);
export const JsonObject = rt.Dictionary(JsonValue, rt.String);

// function wrappers

/**
 * Parse a JSON value from a string.
 */
export function parseJson(text: string): JsonValue {
  const parseResult = JSON.parse(text);
  const jsonValue = JsonValue.check(parseResult);
  return jsonValue;
}

/**
 * Query a JSON value with path segments.
 */
export function queryJson(
  value: JsonValue | undefined,
  path: (number | string)[]
): JsonValue | undefined {
  const pathHead = path[0];
  if (pathHead === undefined) {
    return value;
  }

  let subValue;
  if (JsonArray.guard(value) && typeof pathHead === "number") {
    subValue = value[pathHead];
  } else if (JsonObject.guard(value) && typeof pathHead === "string") {
    subValue = value[pathHead];
  }

  const pathTail = path.slice(1);
  return queryJson(subValue, pathTail);
}
