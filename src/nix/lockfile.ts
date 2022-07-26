import * as fs from "fs/promises";
import * as path from "path";
import * as rt from "runtypes";

export type UnsupportedFlakeRef = Map<string, string>;

export class LockedGitHubFlakeRef {
  owner: string;
  repo: string;
  rev: string;

  constructor(owner: string, repo: string, rev: string) {
    this.owner = owner;
    this.repo = repo;
    this.rev = rev;
  }
}

export class OriginalGitHubFlakeRef {
  owner: string;
  repo: string;
  rev?: string;
  ref?: string;

  constructor(owner: string, repo: string, rev?: string, ref?: string) {
    this.owner = owner;
    this.repo = repo;
    this.rev = rev;
    this.ref = ref;
  }
}

export type LockedFlakeRef = UnsupportedFlakeRef | LockedGitHubFlakeRef;
export type OriginalFlakeRef = UnsupportedFlakeRef | OriginalGitHubFlakeRef;

export class Node {
  locked: LockedFlakeRef;
  original: OriginalFlakeRef;

  constructor(locked: LockedFlakeRef, original: OriginalFlakeRef) {
    this.locked = locked;
    this.original = original;
  }
}

/**
 * A subset of the Nix flake lockfiles.
 * @see {@link https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-flake.html}
 */
export class Lockfile {
  nodes: Map<string, Node>;

  constructor(nodes: Map<string, Node>) {
    this.nodes = nodes;
  }
}

const FlakeRefJson = rt.Intersect(
  rt.Record({ type: rt.String }),
  rt.Dictionary(rt.String, rt.String)
);
type FlakeRefJson = rt.Static<typeof FlakeRefJson>;
enum FlakeRefType {
  GitHub = "github",
}
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
    nodes.set(nodeLabel, new Node(locked, original));
  }

  return new Lockfile(nodes);
}

export async function load(dir: string): Promise<Lockfile> {
  const filePath = path.join(dir, FILE_NAME);
  const fileText = await fs.readFile(filePath, { encoding: "utf-8" });
  const lockfile = parse(fileText);
  return lockfile;
}

function parseLockedFlakeRef(locked: FlakeRefJson): LockedFlakeRef {
  if (locked.type === FlakeRefType.GitHub) {
    return new LockedGitHubFlakeRef(locked.owner, locked.repo, locked.rev);
  }
  return new Map(Object.entries(locked));
}

function parseOriginalFlakeRef(original: FlakeRefJson): OriginalFlakeRef {
  if (original.type === FlakeRefType.GitHub) {
    return new OriginalGitHubFlakeRef(
      original.owner,
      original.repo,
      original.rev,
      original.ref
    );
  }
  return new Map(Object.entries(original));
}
