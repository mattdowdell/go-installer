/**
 * Gathers 3 pieces of information:
 *
 * - Thye binary name from the package path.
 * - The version, converting 'latest' to an actual version to support cache invalidation.
 * - The cache key based on the name, version and runner.
 */
module.exports = async ({core, exec}) => {
	const pkg = process.env.package;

	const name = getBinName(pkg)
	core.setOutput('name', name);

	const version = process.env.version;
	if (version != 'latest') {
		core.setOutput('version', version);
		core.setOutput('key', makeKey({core, name, version}));

		return
	}

	const paths = getModules(pkg);

	for (const mod of getModules()) {
		const result = await exec.getExecOutput(
			'go',
			['list', '-m', '-versions', '-mod=readonly', '-json',  mod],
			{ ignoreReturnCode: true }
		);

		if (result.code == 0) {
			const data = JSON.parse(result.stdout);
			// google.golang.org returns success when not in the module root
			if (!data.hasOwnProperty('Versions')) {
				continue;
			}

			const version = data.Versions[data.Versions.length - 1];

			core.setOutput('version', version);
			core.setOutput('key', makeKey({core, name, version}));

			return;
		}
	}

	core.setFailed('failed to identify go module');
}

function makeKey({ core, name, version }) {
	return [
		"go-install"
		core.platform,
		core.arch,
		name,
		version,
	].join('-');
}

/**
 * Get the name of the binary to be installed.
 */
function getBinName(pkg) {
	const parts = pkg.split('/');

	let name = parts[parts.length - 1];
	if (/v\d+/.test(name)) {
		name = parts[parts.length - 1];
	}

	return name
}

/**
 * Get the potential module paths to get a version from.
 */
function getModules(pkg) {
	const mods = [];

	while (pkg.lastIndexOf('/') > -1) {
		mods.push(pkg)
		pkg = parent(pkg)
	}

	return mods
}

/**
 * Get the parent of the given package path.
 */
function parent(pkg) {
	return pkg.split('/').slice(0, -1).join('/')
}
