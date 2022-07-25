import * as fs from "fs/promises";
import * as path from "path";
import {
  Boolean,
  Dictionary,
  Literal,
  Number,
  Optional,
  Record,
  Static,
  String,
  Union,
} from "runtypes";

const Inputs = Dictionary(String, String);
export type Inputs = Static<typeof Inputs>;

const GitHubFlakeRef = Record({
  type: Literal("github"),
  owner: String,
  repo: String,
  ref: Optional(String),
  rev: Optional(String),
});
export type GitHubFlakeRef = Static<typeof GitHubFlakeRef>;

const UnsupportedFlakeRef = Dictionary(String, String);
export type UnsupportedFlakeRef = Static<typeof UnsupportedFlakeRef>;

const FlakeRef = Union(GitHubFlakeRef, UnsupportedFlakeRef);
export type FlakeRef = Static<typeof FlakeRef>;

const RootNode = Record({
  inputs: Inputs,
});
export type RootNode = Static<typeof RootNode>;

const DependencyNode = Record({
  inputs: Optional(Inputs),
  locked: FlakeRef,
  original: FlakeRef,
  flake: Optional(Boolean),
});
export type DependencyNode = Static<typeof DependencyNode>;

const Node = Union(RootNode, DependencyNode);
export type Node = Static<typeof Node>;

const Lockfile = Record({
  version: Number,
  root: String,
  nodes: Dictionary(Node, String),
});
export type Lockfile = Static<typeof Lockfile>;

const SUPPORTED_VERSION = 7;
const FILE_NAME = "flake.lock";

export function parse(json: string): Lockfile {
  const jsonObj = JSON.parse(json);
  const lockfile = Lockfile.check(jsonObj);
  if (lockfile.version !== SUPPORTED_VERSION) {
    throw new Error("The lockfile is of an unsupported version.");
  }
  return lockfile;
}

export async function load(dir: string): Promise<Lockfile> {
  const filePath = path.join(dir, FILE_NAME);
  const fileText = await fs.readFile(filePath, { encoding: "utf-8" });
  const lockfile = parse(fileText);
  return lockfile;
}

export function getDependencyNodes(
  lockfile: Lockfile
): Map<string, DependencyNode> {
  const nodes = new Map<string, DependencyNode>();
  for (const nodeLabel in lockfile.nodes) {
    if (nodeLabel === lockfile.root) {
      continue;
    }
    const node = lockfile.nodes[nodeLabel];
    nodes.set(nodeLabel, DependencyNode.check(node));
  }
  return nodes;
}

export function getFlakeRefUrl(flakeRef: FlakeRef): string {
  if (GitHubFlakeRef.guard(flakeRef)) {
    let urlBase = `github:${flakeRef.owner}/${flakeRef.repo}`;
    const revOrRef = flakeRef.rev || flakeRef.ref;
    if (revOrRef !== undefined) {
      urlBase += "/" + revOrRef;
    }
    return urlBase;
  }

  throw new TypeError("unsupported flake reference type");
}
