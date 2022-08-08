import * as core from "@actions/core";
import * as util from "util";

import { compareLockfiles } from "./changes.js";
import { loadLockfile } from "./lockfile.js";
import * as nix from "./nix.js";
import { generateReport } from "./report.js";

async function main() {
  const projectDir = process.cwd();
  const flake = new nix.Flake(projectDir);

  const nixSystem = await nix.getSystem();
  printDebug("nix system", nixSystem);

  const outputs = await flake.show();
  printDebug("outputs", outputs);

  // get current installables
  const oldInstallables = await nix.getInstallables(
    outputs,
    nixSystem,
    projectDir
  );
  printDebug("old installables", oldInstallables);

  // read current lockfile
  const oldLockfile = await loadLockfile(projectDir);
  printDebug("old lockfile", oldLockfile);

  // update flake's inputs
  core.info("Updating the flake's inputs...");
  const updateLog = await flake.update();
  core.group("Output of `nix flake update`", async () => {
    core.info(updateLog);
  });

  // read updated lockfile
  const newLockfile = await loadLockfile(projectDir);
  printDebug("new lockfile", newLockfile);

  // get updated installables
  const newInstallables = await nix.getInstallables(
    outputs,
    nixSystem,
    projectDir
  );
  printDebug("new installables", newInstallables);

  // get changes between lockfiles
  const changes = compareLockfiles(oldLockfile, newLockfile);
  printDebug("changes", changes);
  if (changes.size === 0) {
    core.info("The nodes in the lockfile did not change.");
    return;
  }

  // get changes between installables
  // TODO

  // generate textual report from changes
  const report = generateReport(changes);
  printDebug("report", report);

  // set outputs
  core.setOutput("commit-message", report.title);
  core.setOutput("pull-request-title", report.title);
  core.setOutput("pull-request-body", report.body);
}

export function printDebug(valueName: string, value: unknown) {
  const valueStr = util.inspect(value, { depth: null });
  core.debug(`${valueName} = ${valueStr}`);
}

try {
  main();
} catch (error) {
  const errorMsg = error instanceof Error ? error : "unknown error type";
  core.setFailed(errorMsg);
}
