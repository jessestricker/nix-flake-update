import * as core from "@actions/core";

import * as util from "../util";

export async function flakeUpdate(dir: string) {
  core.info("Updating the flake inputs...");
  const output = await util.runCommand("nix", ["flake", "update"], dir);
  core.group("Output of `nix flake update`", async () => {
    core.info(output.stderr);
  });
}
