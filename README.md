# go-installer

A GitHub Action for installing and caching Go binaries.

## Usage

```yaml
name: CI
on:
  pull_request:
jobs:
  example:
    name: Example
    runs-on: ubuntu-latest
    steps:
      - name: Install Go
        uses: actions/setup-go@v5

      - name: Install latest tool
        uses: mattdowdell/go-installer@v0.1.0
        with:
          package: github.com/example/some-tool
          # version defaults to latest

      - name: Install version of tool
        uses: mattdowdell/go-installer@v0.1.0
        with:
          package: github.com/example/some-other-tool
          version: v1.0.0

      - name: Install version of tool from go.mod
        uses: mattdowdell/go-installer@v0.1.0
        with:
          package: github.com/example/another-tool
          version-file: go.mod
```

## Inputs

| Name           | Type   | Default  | Description                                 |
| -------------- | ------ | -------- | ------------------------------------------- |
| `package`      | String |          | The Go package to install.                  |
| `version`      | String | `latest` | The Go package version to install.          |
| `version-file` | String |          | The `go.mod` file to take the version from. |

### version-file

The `version-file` input is intended for when tool versions are tracked
alongside other dependencies in a `go.mod` file. For example:

```go
// tools.go

package main

import (
  _ "github.com/example/some-tool"
  _ "github.com/example/some-other-tool"
  _ "github.com/example/another-tool"
)
```

After running `go mod tidy`, the tool versions will be tracked in `go.mod`. The
versions can then be upgraded manually or with your chosen dependency management
solution, e.g. [Dependabot] or [Renovate].

[Dependabot]: https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates
[Renovate]: https://docs.renovatebot.com/

## Outputs

| Name      | Type   | Description                                      |
| --------- | ------ | ------------------------------------------------ |
| `cached`  | String | Whether the binary was installed from the cache. |
| `name`    | String | The name of the installed binary.                |
| `version` | String | The installed version.                           |

If the `version` input was latest, it will be the actual version that was
installed. Otherwise it will be identical to the `version` input.
