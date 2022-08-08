import * as exec from "@actions/exec";

import { debugInspect } from "./log";

export type Output = exec.ExecOutput;

export async function runCommand(
  cmd: string,
  args: string[],
  dir?: string
): Promise<Output> {
  const options: exec.ExecOptions = { silent: true, ignoreReturnCode: true };
  if (dir !== undefined) {
    options.cwd = dir;
  }
  const output = await exec.getExecOutput(cmd, args, options);

  let cmdLine = cmd;
  if (args.length !== 0) {
    cmdLine += " " + args.join(" ");
  }

  if (output.exitCode === 0) {
    debugInspect(`output of '${cmdLine}'`, output);
    return output;
  }

  let msg = `The command '${cmdLine}' failed with exit code ${output.exitCode}`;
  if (output.stdout !== "") {
    msg += `\nstandard output:\n${output.stdout}`;
  }
  if (output.stderr !== "") {
    msg += `\nstandard error:\n${output.stderr}`;
  }

  throw new Error(msg);
}
