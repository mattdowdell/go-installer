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
```

## Inputs

| Name      | Type   | Default  | Description                        |
| --------- | ------ | -------- | ---------------------------------- |
| `package` | String |          | The Go package to install.         |
| `version` | String | `latest` | The Go package version to install. |

## Outputs

| Name      | Type   | Description                                      |
| --------- | ------ | ------------------------------------------------ |
| `cached`  | String | Whether the binary was installed from the cache. |
| `name`    | String | The name of the installed binary.                |
| `version` | String | The installed version.                           |

If the `version` input was latest, it will be the actual version that was
installed. Otherwise it will be identical to the `version` input.
