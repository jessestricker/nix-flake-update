import * as fs from "fs/promises";
import * as path from "path";
import * as process from "process";
import * as rt from "runtypes";

namespace Runtypes {
  const NodeLabel = rt.String;
  const InputName = rt.String;
  const Inputs = rt.Dictionary(NodeLabel, InputName);

  const GitHubFlakeRef = rt.Record({
    type: rt.Literal("github"),
    owner: rt.String,
    repo: rt.String,
    ref: rt.Optional(rt.String),
    rev: rt.Optional(rt.String),
  });

  const GitHubLockedFlakeRef = rt.Record({
    type: rt.Literal("github"),
    owner: rt.String,
    repo: rt.String,
    rev: rt.String,
  });

  const FlakeRef = rt.Union(GitHubFlakeRef);
  const LockedFlakeRef = rt.Union(GitHubLockedFlakeRef);

  const Node = rt.Record({
    inputs: rt.Optional(Inputs),
    original: rt.Optional(FlakeRef), // always empty in the root node
    locked: rt.Optional(LockedFlakeRef), // always empty in the root node
    flake: rt.Optional(rt.Boolean),
  });
  export const Lockfile = rt.Record({
    version: rt.Number,
    root: rt.String,
    nodes: rt.Dictionary(Node, NodeLabel),
  });
}

export const FILE_NAME = "flake.lock";
export const VERSION = 7;

/**
 * The lockfile of a Nix flake.
 * @see https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-flake.html#lock-files
 */
export type Lockfile = rt.Static<typeof Runtypes.Lockfile>;

/**
 * Parses the lockfile from a JSON string.
 */
export function parse(text: string): Lockfile {
  const obj = JSON.parse(text);
  const lockfile = Runtypes.Lockfile.check(obj);
  if (lockfile.version !== VERSION) {
    throw new Error(
      `The lockfile has an incompatible version: expected ${VERSION}, got ${lockfile.version}`
    );
  }
  return lockfile;
}

/**
 * Loads the lockfile from the current working directory.
 */
export async function loadCurrent(): Promise<Lockfile> {
  const filePath = path.join(process.cwd(), FILE_NAME);
  const fileContent = await fs.readFile(filePath, { encoding: "utf-8" });
  return parse(fileContent);
}
