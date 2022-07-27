import * as fs from "fs/promises";
import * as path from "path";
import * as rt from "runtypes";

export interface FlakeRef {
  readonly type: string;
  [key: string]: boolean | number | string | undefined;
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

export const GitHubFlakeRefJson = rt.Record({
  type: rt.Literal("github"),
  owner: rt.String,
  repo: rt.String,
  rev: rt.Optional(rt.String),
  ref: rt.Optional(rt.String),
});
export type GitHubFlakeRefJson = rt.Static<typeof GitHubFlakeRefJson>;

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

export async function loadLockfile(dir: string): Promise<Lockfile> {
  const filePath = path.join(dir, FILE_NAME);
  const fileText = await fs.readFile(filePath, { encoding: "utf-8" });
  const lockfile = parse(fileText);
  return lockfile;
}

function parseLockedFlakeRef(locked: FlakeRefJson): FlakeRef {
  if (GitHubFlakeRefJson.guard(locked)) {
    return GitHubFlakeRefJson.check({
      type: "github",
      owner: locked.owner,
      repo: locked.repo,
      rev: rt.String.check(locked.rev),
    });
  }
  return { ...locked };
}

function parseOriginalFlakeRef(original: FlakeRefJson): FlakeRef {
  if (GitHubFlakeRefJson.guard(original)) {
    return GitHubFlakeRefJson.check({
      type: "github",
      owner: original.owner,
      repo: original.repo,
      rev: original.rev,
      ref: original.ref,
    });
  }
  return { ...original };
}

export function getFlakeRefUri(flakeRef: FlakeRef): string {
  if (GitHubFlakeRefJson.guard(flakeRef)) {
    let uri = `github:${flakeRef.owner}/${flakeRef.repo}`;
    const revOrRef = flakeRef.rev || flakeRef.ref;
    if (revOrRef !== undefined) {
      uri += "/" + revOrRef;
    }
    return uri;
  }

  throw new TypeError("Unsupported flake ref type");
}
