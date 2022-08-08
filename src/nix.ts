import * as command from "./util/command.js";

export class Flake {
  private dir: string;

  /**
   * @param dir The directory where the flake is located.
   */
  constructor(dir: string) {
    this.dir = dir;
  }

  /**
   * Executes `nix flake <cmd> [args...]` and returns the output.
   */
  private async exec(
    cmd: string,
    args: string[] = []
  ): Promise<command.Output> {
    const cmdArgs = ["flake", cmd, ...args];
    const output = await command.runCommand("nix", cmdArgs, this.dir);
    return output;
  }

  /**
   * Updates the flake's lockfile.
   */
  async update(): Promise<string> {
    const output = await this.exec("update");
    return output.stderr;
  }

/**
 * Get the Nix `system` string of the current Nix installation.
 * @returns One of the values in `nixpkgs#lib.systems.flakeExposed`.
 */
export async function getSystem(): Promise<string> {
  const cmdOutput = await command.runCommand("nix", [
    "eval",
    "--raw",
    "--read-only",
    "--no-update-lock-file",
    "nixpkgs#system",
  ]);
  return cmdOutput.stdout;
}
