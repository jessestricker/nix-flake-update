import * as core from "@actions/core";
import fastDeepEqual from "fast-deep-equal/es6";

import * as nixCommand from "./nix/command";
import { getFlakeRefUri, loadLockfile, Lockfile, Node } from "./nix/lockfile";
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
  core.info(`The pull-request title will be "${report.title}".`);
  core.summary.addRaw(report.body);
  await core.summary.write();
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

interface Report {
  title: string;
  body: string;
}

function generateReport(changes: LockfileChanges): Report {
  const nodeLabels = [changes.updated, changes.added, changes.removed]
    .map((nodesMap) => Array.from(nodesMap.keys()))
    .flat();
  const quotedNodeLabels = nodeLabels
    .map((nodeLabel) => "`" + nodeLabel + "`")
    .join(", ");

  // generate title
  const title = (() => {
    const pluralS = nodeLabels.length !== 1 ? "s" : "";
    return `build(deps): bump flake input${pluralS} ${quotedNodeLabels}`;
  })();

  // generate body

  function generateSimpleSection(
    title: string,
    nodes: Map<string, Node>
  ): string {
    let text = "## " + title + "\n\n";
    for (const [nodeLabel, node] of nodes) {
      const uri = getFlakeRefUri(node.locked);
      text += "* `" + nodeLabel + "`: `" + uri + "`\n";
    }
    return text;
  }

  function generateDiffingSection(
    title: string,
    nodes: Map<string, NodeUpdate>
  ): string {
    let text = "## " + title + "\n\n";
    for (const [nodeLabel, nodeUpdate] of nodes) {
      const oldUri = getFlakeRefUri(nodeUpdate.oldNode.locked);
      const newUri = getFlakeRefUri(nodeUpdate.newNode.locked);
      text += "* `" + nodeLabel + "`:\n";
      text += "  `" + oldUri + "`\n";
      text += "  `" + newUri + "`\n";
    }
    return text;
  }

  let body = "";
  if (changes.updated.size !== 0) {
    body += generateDiffingSection("Updated inputs", changes.updated) + "\n";
  }
  if (changes.added.size !== 0) {
    body += generateSimpleSection("Added inputs", changes.added) + "\n";
  }
  if (changes.removed.size !== 0) {
    body += generateSimpleSection("Removed inputs", changes.removed) + "\n";
  }

  return { title, body };
}

try {
  main();
} catch (error) {
  const errorMsg = error instanceof Error ? error : "unknown error type";
  core.setFailed(errorMsg);
}
