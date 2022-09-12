import assert from "assert/strict";

import {
  InstallableChange,
  LockfileChanges,
  LockfileNodeUpdate,
} from "./changes.js";
import {
  FlakeRef,
  getFlakeRefUri,
  GitHubFlakeRefJson,
  Node,
} from "./lockfile.js";
import { transformValues } from "./util/itererables.js";

/**
 * A textual report of the lockfile changes.
 */
export interface Report {
  title: string;
  body: string;
}

/**
 * Generate a report mentioning all changed lockfile nodes
 * and installable outputs' closures.
 *
 * @param lockfileChanges must not be empty
 */
export function generateReport(
  lockfileChanges: LockfileChanges,
  installableChanges: InstallableChange[]
): Report {
  assert.notEqual(lockfileChanges.size, 0);
  const title = generateTitle(lockfileChanges);
  const body = generateBody(lockfileChanges, installableChanges);
  return { title, body };
}

function generateTitle(changes: LockfileChanges): string {
  const nodeLabels = changes.nodeLabels
    .map((label) => `\`${label}\``)
    .join(", ");
  const inputs = changes.size === 1 ? "input" : "inputs";
  const title = `build(deps): bump flake ${inputs} ${nodeLabels}`;
  return title;
}

function generateBody(
  lockfileChanges: LockfileChanges,
  installableChanges: InstallableChange[]
): string {
  let body = "";
  body += generateBodyDiffingSection("Updated Inputs", lockfileChanges.updated);
  body += generateBodySimpleSection("Added Inputs", lockfileChanges.added);
  body += generateBodySimpleSection("Removed Inputs", lockfileChanges.removed);
  body += generateBodyInstallablesSection(
    "Changed Outputs",
    installableChanges
  );
  return body;
}

function generateBodyDiffingSection(
  title: string,
  nodes: Map<string, LockfileNodeUpdate>
): string {
  const items = transformValues(nodes, (nodeUpdate) => {
    const oldFlakeRefUri = getFlakeRefUri(nodeUpdate.oldNode.locked);
    const newFlakeRefUri = getFlakeRefUri(nodeUpdate.newNode.locked);
    let text = "";
    text += "\n";
    text += `  \`${oldFlakeRefUri}\` →\n`;
    text += `  \`${newFlakeRefUri}\``;
    const compareUrl = getCompareUrl(
      nodeUpdate.oldNode.locked,
      nodeUpdate.newNode.locked
    );
    if (compareUrl !== undefined) {
      text += "\n";
      text += `  __([view changes](${compareUrl}))__`;
    }
    return text;
  });
  return generateBodySection(title, items);
}

function generateBodySimpleSection(
  title: string,
  nodes: Map<string, Node>
): string {
  const items = transformValues(nodes, (node) => {
    const flakeRefUri = getFlakeRefUri(node.locked);
    return `\`${flakeRefUri}\``;
  });
  return generateBodySection(title, items);
}

function generateBodySection(
  title: string,
  items: Map<string, string>
): string {
  if (items.size === 0) {
    return "";
  }
  let text = "";
  text += `## ${title}\n`;
  text += "\n";
  for (const [label, desc] of items) {
    text += `* __${label}:__ ${desc}\n`;
  }
  text += "\n";
  return text;
}

function generateBodyInstallablesSection(
  title: string,
  installableChanges: InstallableChange[]
): string {
  if (installableChanges.length === 0) {
    return "";
  }
  let text = "";
  text += `## ${title}\n`;
  text += "\n";
  for (const change of installableChanges) {
    text += `### \`${change.installable.attrPath}\`\n`;
    text += "```";
    text += change.closureChange;
    text += "```";
  }
  text += "\n";
  return text;
}

function getCompareUrl(
  oldFlakeRef: FlakeRef,
  newFlakeRef: FlakeRef
): string | undefined {
  if (
    // both flakes are GitHub flakes
    GitHubFlakeRefJson.guard(oldFlakeRef) &&
    GitHubFlakeRefJson.guard(newFlakeRef) &&
    // AND they are the same repo
    oldFlakeRef.owner === newFlakeRef.owner &&
    oldFlakeRef.repo === newFlakeRef.repo &&
    // AND the rev is set (this check SHOULD always be true for locked GitHub flake refs)
    oldFlakeRef.rev !== undefined &&
    newFlakeRef.rev !== undefined
  ) {
    return `https://github.com/${oldFlakeRef.owner}/${oldFlakeRef.repo}/compare/${oldFlakeRef.rev}...${newFlakeRef.rev}`;
  }

  return undefined;
}
