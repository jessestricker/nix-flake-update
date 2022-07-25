import * as util from "../util";

export async function flakeUpdate(dir: string) {
  await util.runCommand("nix", ["flake", "update"], dir);
}
