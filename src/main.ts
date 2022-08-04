import * as core from "@actions/core";
import * as util from "util";

import { compareLockfiles } from "./changes.js";
import { loadLockfile } from "./lockfile.js";
import * as nixFlake from "./nixFlake.js";
import { generateReport } from "./report.js";

async function main() {
  const projectDir = process.cwd();

  // read current lockfile
  const oldLockfile = await loadLockfile(projectDir);
  printDebug("old lockfile", oldLockfile);

  // update flake's inputs
  await nixFlake.update(projectDir);

  // read updated lockfile
  const newLockfile = await loadLockfile(projectDir);
  printDebug("new lockfile", newLockfile);

  // get changes between lockfiles
  const changes = compareLockfiles(oldLockfile, newLockfile);
  printDebug("changes", changes);
  if (changes.size === 0) {
    core.info("The nodes in the lockfile did not change.");
    return;
  }

  // generate textual report from changes
  const report = generateReport(changes);
  printDebug("report", report);

  // set outputs
  core.setOutput("commit-message", report.title);
  core.setOutput("pull-request-title", report.title);
  core.setOutput("pull-request-body", report.body);
}

export function printDebug(valueName: string, value: object) {
  const valueStr = util.inspect(value, { depth: null });
  core.debug(`${valueName} = ${valueStr}`);
}

try {
  main();
} catch (error) {
  const errorMsg = error instanceof Error ? error : "unknown error type";
  core.setFailed(errorMsg);
}
