import equal from "fast-deep-equal/es6/index.js";

import { Lockfile, Node } from "./lockfile.js";

/**
 * The set of updated, added and removed nodes between two lockfiles.
 */
export class LockfileChanges {
  updated: Map<string, NodeUpdate> = new Map();
  added: Map<string, Node> = new Map();
  removed: Map<string, Node> = new Map();

  public get size(): number {
    return this.updated.size + this.added.size + this.removed.size;
  }

  public get nodeLabels(): string[] {
    return [this.updated, this.added, this.removed]
      .map((nodesMap) => Array.from(nodesMap.keys()))
      .map((labels) => labels.sort())
      .flat();
  }
}

/**
 * The old and new versions of an updated node.
 */
export class NodeUpdate {
  oldNode: Node;
  newNode: Node;

  constructor(oldNode: Node, newNode: Node) {
    this.oldNode = oldNode;
    this.newNode = newNode;
  }
}

/**
 * Compare two lockfiles and return the set of changes.
 */
export function compareLockfiles(
  oldLockfile: Lockfile,
  newLockfile: Lockfile
): LockfileChanges {
  const changes = new LockfileChanges();

  // check for updated and removed nodes
  for (const [nodeLabel, oldNode] of oldLockfile.nodes) {
    const newNode = newLockfile.nodes.get(nodeLabel);

    // check if the node no longer exists in new lockfile
    if (newNode === undefined) {
      changes.removed.set(nodeLabel, oldNode);
    }
    // check if the locked flake reference was updated
    else if (!equal(oldNode.locked, newNode.locked)) {
      changes.updated.set(nodeLabel, { oldNode, newNode });
    }
  }

  // check for added nodes
  for (const [nodeLabel, newNode] of newLockfile.nodes) {
    // check if the node did not exist in the old lockfile
    if (!oldLockfile.nodes.has(nodeLabel)) {
      changes.added.set(nodeLabel, newNode);
    }
  }

  return changes;
}
