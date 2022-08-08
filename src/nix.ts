import * as rt from "runtypes";

import * as command from "./util/command.js";
import {
  JsonArray,
  JsonObject,
  JsonValue,
  parseJson,
  queryJson,
} from "./util/json.js";

/**
 * Runs `nix ...` commands.
 */
export class Nix {
  /**
   * Evaluate a Nix expression.
   * @see {@link https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-eval.html}
   */
  static async eval(expr: string, dir?: string): Promise<JsonValue> {
    const cmdOutput = await command.runCommand(
      "nix",
      ["eval", "--json", "--read-only", "--no-update-lock-file", expr],
      dir
    );
    return parseJson(cmdOutput.stdout);
  }

  /**
   * Get the store path produced by an installable.
   * @see {@link https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-path-info.html}
   */
  static async pathInfo(installable: string, dir?: string): Promise<string> {
    const cmdOutput = await command.runCommand(
      "nix",
      ["path-info", "--json", "--no-update-lock-file", installable],
      dir
    );

    const pathInfos = JsonArray.check(parseJson(cmdOutput.stdout));
    if (pathInfos.length !== 1) {
      throw new Error("Output of `nix path-info` must be an array of length 1");
    }

    const PathInfo = rt.Record({ path: rt.String });
    return PathInfo.check(pathInfos[0]).path;
  }

  /**
   * Get text about what packages and versions were added and removed between two closures.
   * @see {@link https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-store-diff-closures.html}
   */
  static async storeDiffClosures(
    before: string,
    after: string,
    dir?: string
  ): Promise<string> {
    const cmdOutput = await command.runCommand(
      "nix",
      ["store", "diff-closures", "--no-update-lock-file", before, after],
      dir
    );
    return cmdOutput.stdout;
  }
}

/**
 * Get the Nix `system` string of the current Nix installation.
 * @returns One of the values in `nixpkgs#lib.systems.flakeExposed`.
 */
export async function getSystem(): Promise<string> {
  const system = await Nix.eval("nixpkgs#system");
  return rt.String.check(system);
}

/**
 * Runs `nix flake ...` commands from the flake directory.
 */
export class Flake {
  private dir: string;

  /**
   * @param dir The directory containing the `flake.nix` file.
   */
  constructor(dir: string) {
    this.dir = dir;
  }

  /**
   * Execute `nix flake <cmd> [args...]` and returns the output.
   */
  private async exec(
    cmd: string,
    args: string[] = []
  ): Promise<command.Output> {
    const cmdArgs = ["flake", cmd, ...args];
    const cmdOutput = await command.runCommand("nix", cmdArgs, this.dir);
    return cmdOutput;
  }

  /**
   * Update the flake's lockfile.
   * @see {@link https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-flake-update.html}
   */
  async update(): Promise<string> {
    const cmdOutput = await this.exec("update");
    return cmdOutput.stderr;
  }

  /**
   * Get the outputs provided by this flake.
   * @see {@link https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-flake-show.html}
   */
  async show(): Promise<JsonObject> {
    const cmdOutput = await this.exec("show", [
      "--json",
      "--no-update-lock-file",
    ]);
    const outputs = parseJson(cmdOutput.stdout);
    return JsonObject.check(outputs);
  }

  mapOutputsToInstallables(outputs: JsonObject, system: string): Installable[] {
    const SUPPORTED_ATTRS_PATHS = [
      ["packages", system, "default"],
      ["devShells", system, "default"],
      ["formatter", system],
    ];

    const Derivation = rt.Record({
      type: rt.Literal("derivation"),
      name: rt.String,
    });

    const installables = SUPPORTED_ATTRS_PATHS.filter((attrPath) => {
      const derivation = queryJson(outputs, attrPath);
      return Derivation.guard(derivation);
    }).map((attrPath) => new Installable(this.dir, attrPath.join(".")));

    return installables;
  }
}

export class Installable {
  flakeRef: string;
  attrPath: string;

  constructor(flakeRef: string, attrPath: string) {
    this.flakeRef = flakeRef;
    this.attrPath = attrPath;
  }

  toString(): string {
    return `${this.flakeRef}#${this.attrPath}`;
  }
}

export type MappedStorePaths = Map<Installable, string>;

export async function getStorePaths(
  installables: Installable[]
): Promise<MappedStorePaths> {
  const storePaths = new Map<Installable, string>();
  for (const installable of installables) {
    const storePath = await Nix.pathInfo(installable.toString());
    storePaths.set(installable, storePath);
  }
  return storePaths;
}
