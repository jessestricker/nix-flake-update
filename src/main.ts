import * as core from "@actions/core";
import fastDeepEqual from "fast-deep-equal/es6";

import * as nixCommand from "./nix/command";
import { loadLockfile, Lockfile, Node } from "./nix/lockfile";
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
  util.printDebug("changes", changes);
}

/**
 * The set of updated, added and removed nodes between two lockfiles.
 */
interface LockfileChanges {
  updated: Map<string, NodeUpdate>;
  added: Map<string, Node>;
  removed: Map<string, Node>;
}

interface NodeUpdate {
  oldNode: Node;
  newNode: Node;
}

function compareLockfiles(
  oldLockfile: Lockfile,
  newLockfile: Lockfile
): LockfileChanges {
  // inputs are matched by node label

  const changes: LockfileChanges = {
    added: new Map(),
    updated: new Map(),
    removed: new Map(),
  };

  // check for updated and removed nodes
  for (const [nodeLabel, oldNode] of oldLockfile.nodes) {
    const newNode = newLockfile.nodes.get(nodeLabel);

    if (newNode === undefined) {
      // removed node
      changes.removed.set(nodeLabel, oldNode);
      continue;
    }

    if (fastDeepEqual(oldNode.locked, newNode.locked)) {
      // nothing changed
      continue;
    }

    // updated node
    changes.updated.set(nodeLabel, { oldNode: oldNode, newNode: newNode });
  }

  // check for added nodes
  for (const [nodeLabel, newNode] of newLockfile.nodes) {
    if (oldLockfile.nodes.has(nodeLabel)) {
      continue;
    }

    // added node
    changes.removed.set(nodeLabel, newNode);
  }

  return changes;
}

try {
  main();
} catch (error) {
  const errorMsg = error instanceof Error ? error : "unknown error type";
  core.setFailed(errorMsg);
}
