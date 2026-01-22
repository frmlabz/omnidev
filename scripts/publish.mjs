#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const RUNTIME_JS_EXTS = new Set([".js", ".mjs", ".cjs"]);
const BUN_RUNTIME_PATTERNS = [
	/\bBun\s*[.[]/,
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

// Only public packages that get published
const PACKAGES = ["packages/cli", "packages/capability"];
const CHECK_ONLY = process.argv.includes("--check") || process.env.OMNIDEV_PUBLISH === "false";

const internalVersions = new Map();
for (const pkgDir of PACKAGES) {
	const pkgJsonPath = join(pkgDir, "package.json");
	const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
	internalVersions.set(pkg.name, pkg.version);
}

// CLI and capability should have the same version (fixed in changeset config)
const cliVersion = internalVersions.get("@omnidev-ai/cli");
const capabilityVersion = internalVersions.get("@omnidev-ai/capability");
if (cliVersion && capabilityVersion && cliVersion !== capabilityVersion) {
	console.error(
		`❌ Version mismatch: @omnidev-ai/cli@${cliVersion} != @omnidev-ai/capability@${capabilityVersion}`,
	);
	console.error("   CLI and capability must share the same version.");
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
