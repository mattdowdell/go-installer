/*global module, process*/

/**
 * Gathers 3 pieces of information:
 *
 * - The binary name from the package path.
 * - The version, converting 'latest' to an actual version to support cache invalidation.
 * - The cache key based on the name, version and runner.
 *
 * TODO: rewrite
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
    await parseVersionFile({ core, glob, path, versionFile });
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

      if (versionFile != "" && !versions.has(mod)) {
        core.setFailed(
          `version-file ${versionFile} is missing package: ${mod}`,
        );
        return;
      }

      let version = data.Versions[data.Versions.length - 1];
      if (versions.has(mod)) {
        version = versions.get(mod);
      }

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
 * Set outputs for when a
 */
async function handleVersionFile({ core, glob, path, versionFile }) {
  if (path.basename(versionFile) != "go.mod") {
    core.setFailed(`version-file is not a go.mod file: ${versionFile}`);
    return
  }

  core.setOutput("dir", path.dirname(versionFile));

  const hash = await glob.hashFiles(versionFile);
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
