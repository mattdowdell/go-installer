/*global module, process*/

/**
 * Installs a Go binary at an optional version.
 *
 * The version is only expected to be unset when a go.mod file is used.
 */
module.exports = async ({ dir, exec }) => {
  const pkg = process.env.package;
  const version = process.env.version;

  let path = pkg;
  if (version != "") {
    path = `${pkg}@${version}`;
  }

  await exec.exec("go", ["install", path], { cwd: dir });
};
