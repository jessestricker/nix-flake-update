import * as core from "@actions/core";

import { compareInstallables, compareLockfiles } from "./changes.js";
import { loadLockfile } from "./lockfile.js";
import * as nix from "./nix.js";
import { generateReport } from "./report.js";
import { debugInspect } from "./util/log";

async function main() {
  const projectDir = process.cwd();
  const flake = new nix.Flake(projectDir);

  const system = await nix.getSystem();
  debugInspect("system", system);

  const outputs = await flake.show();
  debugInspect("outputs", outputs);
  const installables = flake.mapOutputsToInstallables(outputs, system);
  debugInspect("installables", installables);

  // get current store paths
  const oldStorePaths = await nix.getStorePaths(installables);
  debugInspect("old store paths", oldStorePaths);

  // read current lockfile
  const oldLockfile = await loadLockfile(projectDir);
  debugInspect("old lockfile", oldLockfile);

  // update flake's inputs
  core.info("Updating the flake's inputs...");
  const updateLog = await flake.update();
  core.group("Output of `nix flake update`", async () => {
    core.info(updateLog);
  });

  // read updated lockfile
  const newLockfile = await loadLockfile(projectDir);
  debugInspect("new lockfile", newLockfile);

  // get updated store paths
  const newStorePaths = await nix.getStorePaths(installables);
  debugInspect("new store paths", newStorePaths);

  // get changes between lockfiles
  const lockfileChanges = compareLockfiles(oldLockfile, newLockfile);
  debugInspect("changes", lockfileChanges);
  if (lockfileChanges.size === 0) {
    core.info("The nodes in the lockfile did not change.");
    return;
  }

  // get changes between installables
  const installableChanges = await compareInstallables(
    installables,
    oldStorePaths,
    newStorePaths
  );

  // generate textual report from changes
  const report = generateReport(lockfileChanges, installableChanges);
  debugInspect("report", report);

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
