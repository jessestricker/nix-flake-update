import * as fs from "fs/promises";
import * as path from "path";
import * as process from "process";

import * as exec from "@actions/exec";
import * as rt from "runtypes";

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

const FlakeRef = rt.Union(GitHubFlakeRef);

const GitHubLockedFlakeRef = rt.Record({
  type: rt.Literal("github"),
  owner: rt.String,
  repo: rt.String,
  rev: rt.String,
});

const LockedFlakeRef = rt.Union(GitHubLockedFlakeRef);

const Node = rt.Record({
  inputs: rt.Optional(Inputs),
  original: rt.Optional(FlakeRef), // always empty in the root node
  locked: rt.Optional(LockedFlakeRef), // always empty in the root node
  flake: rt.Optional(rt.Boolean),
});

const Lockfile = rt.Record({
  version: rt.Number,
  root: rt.String,
  nodes: rt.Dictionary(Node, NodeLabel),
});

const FILE_NAME = "flake.lock";
const VERSION = 7;

/**
 * The lockfile of a Nix flake.
 * @see https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-flake.html#lock-files
 */
export type Lockfile = rt.Static<typeof Lockfile>;

/**
 * Parses the lockfile from a JSON string.
 */
export function parseLockfile(text: string): Lockfile {
  const obj = JSON.parse(text);
  const lockfile = Lockfile.check(obj);
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
export async function loadLockfile(): Promise<Lockfile> {
  const filePath = path.join(process.cwd(), FILE_NAME);
  const fileContent = await fs.readFile(filePath, { encoding: "utf-8" });
  return parseLockfile(fileContent);
}

/**
 * Updates the locked flake references in the lockfile from the current working directory.
 */
export async function updateLockfile() {
  const output = await exec.getExecOutput("nix", ["flake", "update"], {
    silent: true,
    ignoreReturnCode: true,
  });
  if (output.exitCode !== 0) {
    let msg = `The command 'nix flake update' failed with exit code ${output.exitCode}`;
    if (output.stdout !== "") {
      msg += `\nstandard output:\n${output.stdout}`;
    }
    if (output.stderr !== "") {
      msg += `\nstandard error:\n${output.stderr}`;
    }
    throw new Error(msg);
  }
}
