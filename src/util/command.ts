import * as exec from "@actions/exec";

export interface Output {
  stdout: string;
  stderr: string;
}

export async function runCommand(
  cmd: string,
  args: string[],
  dir: string
): Promise<Output> {
  const output = await exec.getExecOutput(cmd, args, {
    cwd: dir,
    silent: true,
    ignoreReturnCode: true,
  });

  if (output.exitCode === 0) {
    return { stdout: output.stdout, stderr: output.stderr };
  }

  let cmdLine = cmd;
  if (args.length !== 0) {
    cmdLine += " " + args.join(" ");
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
