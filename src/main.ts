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
  nodeLabel: string;
  original: nixLockfile.FlakeRef;
  locked: nixLockfile.FlakeRef;
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

  const oldNodes = nixLockfile.getDependencyNodes(oldLockfile);
  const newNodes = nixLockfile.getDependencyNodes(newLockfile);
  const changes: Changes = { added: [], updated: [], removed: [] };

  // check for updated and removed nodes
  for (const [nodeLabel, oldNode] of oldNodes) {
    const newNode = newNodes.get(nodeLabel);
    if (newNode === undefined) {
      // removed node
      changes.removed.push({
        nodeLabel: nodeLabel,
        original: oldNode.original,
        locked: oldNode.locked,
      });
    } else {
      // updated node
      changes.updated.push({
        nodeLabel: nodeLabel,
        oldOriginal: oldNode.original,
        newOriginal: newNode.original,
        oldLocked: oldNode.locked,
        newLocked: newNode.locked,
      });
    }
  }

  // check for added nodes
  for (const [nodeLabel, newNode] of newNodes) {
    if (!(nodeLabel in oldNodes)) {
      // added node
      changes.added.push({
        nodeLabel: nodeLabel,
        original: newNode.original,
        locked: newNode.locked,
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
