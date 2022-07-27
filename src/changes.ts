import equal from "fast-deep-equal/es6";

import { Lockfile, Node } from "./lockfile";

/**
 * The set of updated, added and removed nodes between two lockfiles.
 */
export interface LockfileChanges {
  updated: Map<string, NodeUpdate>;
  added: Map<string, Node>;
  removed: Map<string, Node>;
}

export interface NodeUpdate {
  oldNode: Node;
  newNode: Node;
}

/**
 * Compares two lockfiles and returns the set of changes.
 */
export function compareLockfiles(
  oldLockfile: Lockfile,
  newLockfile: Lockfile
): LockfileChanges {
  // inputs are matched by node label

  const changes: LockfileChanges = {
    updated: new Map(),
    added: new Map(),
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

    if (equal(oldNode.locked, newNode.locked)) {
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
