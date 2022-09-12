import * as core from "@actions/core";
import * as util from "util";

/**
 * Print a string representation of the complete value
 * to the debug log.
 */
export function debugInspect(valueName: string, value: unknown) {
  const valueStr = util.inspect(value, { depth: null });
  core.debug(`${valueName} = ${valueStr}`);
}
