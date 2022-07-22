import * as util from "util";

import * as core from "@actions/core";
import * as nix from "./nix";

async function main() {
  // read current lockfile
  const oldLockfile = await nix.loadLockfile();
  core.info("old lockfile = \n" + util.inspect(oldLockfile, { depth: null }));
}

try {
  main();
} catch (error) {
  const errorMsg = error instanceof Error ? error : "unknown error type";
  core.setFailed(errorMsg);
}
