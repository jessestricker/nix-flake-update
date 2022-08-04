import * as core from "@actions/core";

import { runCommand } from "./util/command.js";

export async function update(dir: string) {
  core.info("Updating the flake's inputs...");
  const output = await runCommand("nix", ["flake", "update"], dir);
  core.group("Output of `nix flake update`", async () => {
    core.info(output.stderr);
  });
}
