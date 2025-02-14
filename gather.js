/*global module, process*/

/**
 * Gathers various pieces of information:
 *
 * - The binary name from the package path.
 * - The version, converting 'latest' to an actual version to support cache invalidation.
 * - The cache key based on the name, runner and a representation of the version.
 * - The directory to run the 'go install' command from.
 */
module.exports = async ({ core, exec, glob, path }) => {
  const pkg = process.env.package;

  const name = getBinName(pkg);
  core.setOutput("name", name);

  const version = process.env.version;
  if (version != "latest") {
    handleVersion({ core, name, version });
    return;
  }

  const versionFile = process.env.version_file;
  if (versionFile != "") {
    await handleVersionFile({ core, glob, name, path, versionFile });
    return;
  }

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

      let version = data.Versions[data.Versions.length - 1];

      core.setOutput("version", version);
      core.setOutput("key", makeKey(name, version));

      return;
    }
  }

  core.setFailed("failed to identify go module");
};

/**
 * Set outputs for when a specific version has been requested.
 */
function handleVersion({ core, name, version }) {
  core.setOutput("version", version);
  core.setOutput("key", makeKey(name, version));
}

/**
 * Set outputs for when a version file (go.mod) is used.
 */
async function handleVersionFile({ core, glob, name, path, versionFile }) {
  if (path.basename(versionFile) != "go.mod") {
    core.setFailed(`version-file is not a go.mod file: ${versionFile}`);
    return;
  }

  // use a hash so that updating any dependency update invalidates the cache
  const hash = await glob.hashFiles(versionFile);

  core.setOutput("dir", path.dirname(versionFile));
  core.setOutput("key", makeKey(name, hash));
}

/**
 * Build the key to use for cache lookups.
 *
 * Ideally, this would use core instead of process.env, but that requires @actions/core v1.11.0.
 * actions/github-script@v7.0.1 provides @actions/core v1.10.1, which does not provide this info.
 */
function makeKey(name, suffix) {
  return [
    "go-installer",
    process.env.RUNNER_OS,
    process.env.RUNNER_ARCH,
    name,
    suffix,
  ].join("-");
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
