#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const RUNTIME_JS_EXTS = new Set([".js", ".mjs", ".cjs"]);
const BUN_RUNTIME_PATTERNS = [
	/\bBun\s*[\.\[]/,
	/\bfrom\s+["']bun["']/,
	/\brequire\(\s*["']bun["']\s*\)/,
	/\bimport\(\s*["']bun["']\s*\)/,
	/["']bun:/,
];

function scanForBunRuntimeApis(rootDir) {
	const hits = [];
	function walk(dir) {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
				continue;
			}
			if (!RUNTIME_JS_EXTS.has(extname(entry.name))) continue;
			const content = readFileSync(fullPath, "utf8");
			for (const pattern of BUN_RUNTIME_PATTERNS) {
				if (pattern.test(content)) {
					hits.push({ file: fullPath, pattern: pattern.toString() });
					break;
				}
			}
		}
	}
	walk(rootDir);
	return hits;
}

const PACKAGES = ["packages/core", "packages/cli"];
const CHECK_ONLY = process.argv.includes("--check") || process.env.OMNIDEV_PUBLISH === "false";

const internalVersions = new Map();
for (const pkgDir of PACKAGES) {
	const pkgJsonPath = join(pkgDir, "package.json");
	const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
	internalVersions.set(pkg.name, pkg.version);
}

const coreVersion = internalVersions.get("@omnidev-ai/core");
const cliVersion = internalVersions.get("@omnidev-ai/cli");
if (coreVersion && cliVersion && coreVersion !== cliVersion) {
	console.error(
		`❌ Version mismatch: @omnidev-ai/core@${coreVersion} != @omnidev-ai/cli@${cliVersion}`,
	);
	console.error("   Core and CLI must share the same version.");
	process.exit(1);
}

function exec(cmd, opts = {}) {
	console.log(`$ ${cmd}`);
	return execSync(cmd, { stdio: "inherit", ...opts });
}

function execQuiet(cmd, opts = {}) {
	return execSync(cmd, { encoding: "utf8", ...opts }).trim();
}

for (const pkgDir of PACKAGES) {
	const pkgJsonPath = join(pkgDir, "package.json");
	const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

	if (pkg.private) {
		console.log(`⏭️  Skipping private package: ${pkg.name}`);
		continue;
	}

	console.log(`\n📦 ${CHECK_ONLY ? "Checking" : "Publishing"} ${pkg.name}...`);

	const tarball = execQuiet("bun pm pack --quiet", { cwd: pkgDir });
	const tarballPath = join(pkgDir, tarball);

	const extractDir = join(pkgDir, "_pack_inspect");
	mkdirSync(extractDir, { recursive: true });
	exec(`tar -xzf ${tarball} -C _pack_inspect`, { cwd: pkgDir });

	const packedPkgPath = join(extractDir, "package", "package.json");
	const packedPkg = JSON.parse(readFileSync(packedPkgPath, "utf8"));

	let needsFix = false;

	// CLI bundles adapters internally, so remove from published deps.
	// Core is external and must remain as a dependency.
	if (packedPkg.name === "@omnidev-ai/cli" && packedPkg.dependencies) {
		if (packedPkg.dependencies["@omnidev-ai/adapters"]) {
			delete packedPkg.dependencies["@omnidev-ai/adapters"];
			needsFix = true;
		}
	}
	// HACK/TODO: Core exposes test-utils for local dev, but it's bun:test-based.
	// Strip from published exports until we make test-utils Node-compatible or split packages.
	if (packedPkg.name === "@omnidev-ai/core" && packedPkg.exports?.["./test-utils"]) {
		delete packedPkg.exports["./test-utils"];
		needsFix = true;
	}
	for (const depsKey of ["dependencies", "peerDependencies", "optionalDependencies"]) {
		const deps = packedPkg[depsKey];
		if (!deps) continue;

		for (const [name, version] of Object.entries(deps)) {
			if (version.includes("workspace:")) {
				console.error(`❌ Found unresolved workspace protocol: ${name}: ${version}`);
				process.exit(1);
			}
			if (version.includes("0.0.0-auto-managed")) {
				console.warn(`⚠️  Found 0.0.0-auto-managed in ${name}, fixing...`);
				deps[name] = version.replace("0.0.0-auto-managed", pkg.version);
				needsFix = true;
			}
			if (internalVersions.has(name)) {
				const expected = internalVersions.get(name);
				if (expected && version !== expected) {
					console.warn(
						`⚠️  Fixing internal dependency version in ${packedPkg.name}: ${name}@${version} -> ${expected}`,
					);
					deps[name] = expected;
					needsFix = true;
				}
			}
		}
	}

	if (needsFix) {
		writeFileSync(packedPkgPath, `${JSON.stringify(packedPkg, null, 2)}\n`);
		exec(`tar -czf ${tarball} -C _pack_inspect package`, { cwd: pkgDir });
	}

	const bunHits = scanForBunRuntimeApis(join(extractDir, "package"));
	if (bunHits.length > 0) {
		console.error("❌ Bun-specific runtime APIs found in packed output:");
		for (const hit of bunHits) {
			console.error(`  - ${hit.file} (${hit.pattern})`);
		}
		process.exit(1);
	}

	rmSync(extractDir, { recursive: true, force: true });

	if (!CHECK_ONLY) {
		exec(`npm publish ${tarball} --access public`, { cwd: pkgDir });
	}

	rmSync(tarballPath);

	console.log(`✅ ${CHECK_ONLY ? "Checked" : "Published"} ${pkg.name}@${pkg.version}`);
}
