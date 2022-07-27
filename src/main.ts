import * as core from "@actions/core";

import { compareLockfiles } from "./changes";
import * as nixCommand from "./nix/command";
import { loadLockfile } from "./nix/lockfile";
import { generateReport } from "./report";
import * as util from "./util";

async function main() {
  const projectDir = process.cwd();

  // read current lockfile
  const oldLockfile = await loadLockfile(projectDir);
  util.printDebug("old lockfile", oldLockfile);

  // update flake inputs
  await nixCommand.flakeUpdate(projectDir);

  // read updated lockfile
  const newLockfile = await loadLockfile(projectDir);
  util.printDebug("new lockfile", newLockfile);

  // get changes between lockfiles
  const changes = compareLockfiles(oldLockfile, newLockfile);
  const changesCount =
    changes.updated.size + changes.added.size + changes.removed.size;
  if (changesCount === 0) {
    core.info("The nodes in the lockfile did not change.");
    return;
  } else {
    util.printDebug("changes", changes);
  }

  // generate textual report from changes
  const report = generateReport(changes);
  util.printDebug("report", report);

  // set outputs
  core.setOutput("commit-message", report.title);
  core.setOutput("pull-request-title", report.title);
  core.setOutput("pull-request-body", report.body);
}

try {
  main();
} catch (error) {
  const errorMsg = error instanceof Error ? error : "unknown error type";
  core.setFailed(errorMsg);
}
