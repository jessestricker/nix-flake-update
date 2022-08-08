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
}

interface Installable {
  name: string;
  drvName: string;
  storePath: string;
}

/**
 * Filter and map a flake's output to installables.
 */
export async function getInstallables(
  outputs: JsonObject,
  system: string,
  dir: string
): Promise<Installable[]> {
  const SUPPORTED_INSTALLABLES = [
    ["packages", system, "default"],
    ["devShells", system, "default"],
    ["formatter", system],
  ];

  const Derivation = rt.Record({
    type: rt.Literal("derivation"),
    name: rt.String,
  });

  const installables: Installable[] = [];

  for (const nameSegments of SUPPORTED_INSTALLABLES) {
    const derivation = queryJson(outputs, nameSegments);
    if (!Derivation.guard(derivation)) {
      continue;
    }

    const installableName = ".#" + nameSegments.join(".");
    const storePath = await Nix.pathInfo(installableName, dir);

    installables.push({
      name: installableName,
      drvName: derivation.name,
      storePath,
    });
  }

  return installables;
}
