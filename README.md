# Nix Flake Update

[![Checks](https://github.com/jessestricker/nix-flake-update/actions/workflows/checks.yml/badge.svg?branch=main&event=push)](https://github.com/jessestricker/nix-flake-update/actions/workflows/checks.yml)

❄ Keep your Nix Flake inputs up-to-date with this GitHub Action!

## Features

This action does two things:

- updates the project's `flake.lock` file
- compares old and new lockfile to generate a textual report of changed inputs

**Note:** On its own, this action only changes a local checkout of the
repository. This means that you need to use it in combination with another
action to create a commit/pull request with the changed lockfile.

See the [action.yml](./action.yml) file for inputs & outputs.

## Example Workflow

The following snippet can be used as a standalone workflow in any repository
with a `flake.lock` file. In addition to this action, it uses the awesome
[peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request).

It updates the locked inputs every day and creates a pull request with the
changes, just like GitHub's Dependabot. If the pull request is not merged before
new changes are made, the pull request is updated automatically.

```yaml
on:
  schedule:
    - cron: "0 0 * * *" # daily at 00:00

jobs:
  nix-update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # a flake-enabled Nix executable needs to be installed
      # (alternatively use `cachix/install-nix-action`)
      - uses: nixbuild/nix-quick-install-action@v16
        with:
          nix_conf: experimental-features = nix-command flakes

      # updates `flake.lock` and generates change report
      - uses: jessestricker/nix-flake-update@v1
        id: nix-update

      # creates a pull request with the current changes
      - uses: peter-evans/create-pull-request@v4
        with:
          branch: nix-update
          commit-message: ${{ steps.nix-update.outputs.commit-message }}
          title: ${{ steps.nix-update.outputs.pull-request-title }}
          body: ${{ steps.nix-update.outputs.pull-request-body }}
          labels: dependencies, nix
          assignees: jessestricker
```

## Version Policy & Releases

This repository employs semantic versioning. In combination with conventional
commits, this allows the release process to be automated.

To release a new version, run the
[Release workflow](https://github.com/jessestricker/nix-flake-update/actions/workflows/release.yml).
Then, update the major version tag manually.
