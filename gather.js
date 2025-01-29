/*global module, process*/

/**
 * Gathers 3 pieces of information:
 *
 * - The binary name from the package path.
 * - The version, converting 'latest' to an actual version to support cache invalidation.
 * - The cache key based on the name, version and runner.
 */
module.exports = async ({ core, exec, fs, os, path }) => {
  const pkg = process.env.package;

  const name = getBinName(pkg);
  core.setOutput("name", name);

  const version = process.env.version;
  if (version != "latest") {
    core.setOutput("version", version);
    core.setOutput("key", makeKey({ os, name, version }));

    return;
  }

  const versionFile = process.env.version_file;
  const versions = await parseVersionFile({ core, exec, fs, path, versionFile });

  for (const mod of getModules(pkg)) {
    const result = await exec.getExecOutput(
      "go",
      ["list", "-m", "-versions", "-mod=readonly", "-json", mod],
      { ignoreReturnCode: true },
    );

    if (result.exitCode == 0) {
      const data = JSON.parse(result.stdout);

      // google.golang.org returns success when not in the module root
      if (!Object.hasOwn(data, "Versions")) {
        continue;
      }

      if (versionFile != "" && !versions.has(pkg)) {
        core.setFile(`version-file ${versionFile} is missing package: ${pkg}`);
        return;
      }

      let version = data.Versions[data.Versions.length - 1];
      if (versions.has(pkg)) {
        version = versions.get(pkg);
      }

      core.setOutput("version", version);
      core.setOutput("key", makeKey({ os, name, version }));

      return;
    }
  }

  core.setFailed("failed to identify go module");
};

/**
 * parseVersionFile converts a go.mod file to a map of Go modules and versions.
 */
async function parseVersionFile({ core, exec, path, versionFile }) {
  if (versionFile == "") {
    return new Map();
  }

  if (path.basename(versionFile) != "go.mod") {
    core.setFailed(`version-file is not a go.mod file: ${versionFile}`);
    return
  }

  if (!fs.existsSync(versionFile)) {
    core.setFailed(`version-file does not exist: ${versionFile}`);
    return;
  }

  const modDir = path.dirname(versionFile);

  const result = await exec.getExecOutput("go", ["list", "-m", "-json", "all"]);
  const data = JSON.parse(result.stdout);

  return new Map(data.map(d => [d.Path, d.Version]));
}

/**
 * Build the key to use for cache lookups.
 *
 * Ideally, this would use core instead of os, but that requires @actions/core v1.11.0.
 * actions/github-script@v7.0.1 provides @actions/core v1.10.1, which does provide this info.
 */
function makeKey({ os, name, version }) {
  return ["go-installer", os.platform(), os.arch(), name, version].join("-");
}

/**
 * Get the name of the binary to be installed.
 */
function getBinName(pkg) {
  const parts = pkg.split("/");

  let name = parts[parts.length - 1];
  if (/v\d+/.test(name)) {
    name = parts[parts.length - 2];
  }

  return name;
}

/**
 * Get the potential module paths to get a version from.
 */
function getModules(pkg) {
  const mods = [];

  while (pkg.lastIndexOf("/") > -1) {
    mods.push(pkg);
    pkg = parent(pkg);
  }

  return mods;
}

/**
 * Get the parent of the given package path.
 */
function parent(pkg) {
  return pkg.split("/").slice(0, -1).join("/");
}
