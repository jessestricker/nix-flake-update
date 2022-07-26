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

  // get changes between lockfiles
  const changes = compareLockfiles(oldLockfile, newLockfile);
  util.printDebug("changes", changes);
}

interface Changes {
  added: RemoveAddedNode[];
  updated: UpdatedNode[];
  removed: RemoveAddedNode[];
}

interface RemoveAddedNode {
  label: string;
  node: nixLockfile.Node;
}

interface UpdatedNode {
  nodeLabel: string;

  oldOriginal: nixLockfile.FlakeRef;
  newOriginal: nixLockfile.FlakeRef;

  oldLocked: nixLockfile.FlakeRef;
  newLocked: nixLockfile.FlakeRef;
}

function compareLockfiles(
  oldLockfile: nixLockfile.Lockfile,
  newLockfile: nixLockfile.Lockfile
): Changes {
  // inputs are matched by node label

  const changes: Changes = { added: [], updated: [], removed: [] };

  // check for updated and removed nodes
  for (const [nodeLabel, oldNode] of oldLockfile.nodes) {
    const newNode = newLockfile.nodes.get(nodeLabel);
    if (newNode === undefined) {
      // removed node
      changes.removed.push({
        label: nodeLabel,
        node: oldNode,
      });
      continue;
    }

    if (Object.entries(oldNode.locked) === Object.entries(newNode.locked)) {
      // nothing changed
      continue;
    }

    // updated node
    changes.updated.push({
      nodeLabel: nodeLabel,
      oldOriginal: oldNode.original,
      newOriginal: newNode.original,
      oldLocked: oldNode.locked,
      newLocked: newNode.locked,
    });
  }

  // check for added nodes
  for (const [nodeLabel, newNode] of newLockfile.nodes) {
    if (!(nodeLabel in oldLockfile.nodes)) {
      // added node
      changes.added.push({
        label: nodeLabel,
        node: newNode,
      });
    }
  }

  return changes;
}

try {
  main();
} catch (error) {
  const errorMsg = error instanceof Error ? error : "unknown error type";
  core.setFailed(errorMsg);
}
