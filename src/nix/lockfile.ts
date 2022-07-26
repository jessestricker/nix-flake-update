import * as fs from "fs/promises";
import * as path from "path";
import * as rt from "runtypes";

export interface FlakeRef {
  type: string;
  [key: string]: boolean | number | string | undefined;
}

export interface LockedGitHubFlakeRef extends FlakeRef {
  type: "github";
  owner: string;
  repo: string;
  rev: string;
}

export interface OriginalGitHubFlakeRef extends FlakeRef {
  type: "github";
  owner: string;
  repo: string;
  rev?: string; // a commit hash
  ref?: string; // a tag/branch name
}

export interface Node {
  locked: FlakeRef;
  original: FlakeRef;
}

/**
 * A subset of the Nix flake lockfiles.
 * @see {@link https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-flake.html}
 */
export interface Lockfile {
  nodes: Map<string, Node>;
}

const GitHubFlakeRefJson = rt.Record({
  type: rt.Literal("github"),
  owner: rt.String,
  repo: rt.String,
  rev: rt.Optional(rt.String),
  ref: rt.Optional(rt.String),
});
const UnsupportedFlakeRefJson = rt.Intersect(
  rt.Record({ type: rt.String }),
  rt.Dictionary(rt.Union(rt.String, rt.Number), rt.String)
);
const FlakeRefJson = rt.Union(UnsupportedFlakeRefJson, GitHubFlakeRefJson);
type FlakeRefJson = rt.Static<typeof FlakeRefJson>;
const NodeJson = rt.Record({
  inputs: rt.Optional(rt.Dictionary(rt.String, rt.String)),
  locked: rt.Optional(FlakeRefJson),
  original: rt.Optional(FlakeRefJson),
  flake: rt.Optional(rt.Boolean),
});
const LockfileJson = rt.Record({
  version: rt.Number,
  root: rt.String,
  nodes: rt.Dictionary(NodeJson, rt.String),
});

const SUPPORTED_VERSION = 7;
const FILE_NAME = "flake.lock";

export function parse(jsonText: string): Lockfile {
  // parse and validate JSON
  const jsonObject = JSON.parse(jsonText);
  const lockfileJson = LockfileJson.check(jsonObject);

  if (lockfileJson.version !== SUPPORTED_VERSION) {
    throw new Error("The version of the lockfile is not supported.");
  }

  // construct lockfile instance from JSON
  const nodes = new Map<string, Node>();
  for (const nodeLabel in lockfileJson.nodes) {
    // skip root node
    if (nodeLabel == lockfileJson.root) {
      continue;
    }
    const nodeJson = lockfileJson.nodes[nodeLabel];

    // parse flake references
    if (nodeJson.locked === undefined || nodeJson.original === undefined) {
      throw new TypeError(
        `The node ${nodeLabel} is missing the flake references.`
      );
    }
    const locked = parseLockedFlakeRef(nodeJson.locked);
    const original = parseOriginalFlakeRef(nodeJson.original);

    // add node to map
    nodes.set(nodeLabel, { locked, original });
  }

  return { nodes };
}

export async function load(dir: string): Promise<Lockfile> {
  const filePath = path.join(dir, FILE_NAME);
  const fileText = await fs.readFile(filePath, { encoding: "utf-8" });
  const lockfile = parse(fileText);
  return lockfile;
}

function parseLockedFlakeRef(locked: FlakeRefJson): FlakeRef {
  if (GitHubFlakeRefJson.guard(locked)) {
    const ref: LockedGitHubFlakeRef = {
      type: "github",
      owner: locked.owner,
      repo: locked.repo,
      rev: rt.String.check(locked.rev),
    };
    return ref;
  }
  return { ...locked };
}

function parseOriginalFlakeRef(original: FlakeRefJson): FlakeRef {
  if (GitHubFlakeRefJson.guard(original)) {
    const ref: OriginalGitHubFlakeRef = {
      type: "github",
      owner: original.owner,
      repo: original.repo,
      rev: original.rev,
      ref: original.ref,
    };
    return ref;
  }
  return { ...original };
}
