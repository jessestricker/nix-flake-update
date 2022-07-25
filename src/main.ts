import * as core from "@actions/core";

import * as nixCommand from "./nix/command";
import * as nixLockfile from "./nix/lockfile";
import * as util from "./util";

async function main() {
  const projectDir = process.cwd();

  // read current lockfile
  const oldLockfile = await nixLockfile.load(projectDir);
  util.printDebug("old lockfile", oldLockfile);

  // update flake inputs
  await nixCommand.flakeUpdate(projectDir);

  // read updated lockfile
  const newLockfile = await nixLockfile.load(projectDir);
  util.printDebug("new lockfile", newLockfile);
}

try {
  main();
} catch (error) {
  const errorMsg = error instanceof Error ? error : "unknown error type";
  core.setFailed(errorMsg);
}
