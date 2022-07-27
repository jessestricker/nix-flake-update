import { LockfileChanges, NodeUpdate } from "./changes.js";
import {
  FlakeRef,
  getFlakeRefUri,
  GitHubFlakeRefJson,
  Node,
} from "./lockfile.js";

export interface Report {
  title: string;
  body: string;
}

export function generateReport(changes: LockfileChanges): Report {
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
      text += "* **" + nodeLabel + "**: `" + uri + "`\n";
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
      text += "* **" + nodeLabel + "**:\n";
      text += "  `" + oldUri + "` →\n";
      text += "  `" + newUri + "`\n";
      const compareUrl = getCompareUrl(
        nodeUpdate.oldNode.locked,
        nodeUpdate.newNode.locked
      );
      if (compareUrl !== undefined) {
        text += `  __([view changes](${compareUrl}))__\n`;
      }
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
