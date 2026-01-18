import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function parseJson(text, label) {
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new Error(
			`Failed to parse ${label} as JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function runCommand(command, args, options) {
	return await new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, {
			cwd: options?.cwd,
			env: options?.env ?? process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		child.stdout?.setEncoding("utf-8");
		child.stderr?.setEncoding("utf-8");
		child.stdout?.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk;
		});

		child.on("error", (error) => rejectPromise(error));
		child.on("close", (code) => {
			resolvePromise({ exitCode: code ?? 0, stdout, stderr });
		});
	});
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

async function installTempBun() {
	const bunInstallDir = join(
		tmpdir(),
		`omnidev-bun-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
	);
	await mkdir(bunInstallDir, { recursive: true });

	const install = await runCommand("bash", ["-lc", "curl -fsSL https://bun.sh/install | bash"], {
		env: { ...process.env, BUN_INSTALL: bunInstallDir },
	});
	assert(install.exitCode === 0, `bun install failed\n${install.stderr}`);

	const bunPath = join(bunInstallDir, "bin", "bun");
	const bunEnv = {
		...process.env,
		BUN_INSTALL: bunInstallDir,
		PATH: `${join(bunInstallDir, "bin")}:${process.env.PATH ?? ""}`,
	};
	const check = await runCommand(bunPath, ["--version"], { env: bunEnv });
	assert(check.exitCode === 0, `bun install failed\n${check.stderr}`);

	return { bunInstallDir, bunPath, bunEnv };
}

async function removeTempBun(bunInstallDir) {
	await rm(bunInstallDir, { recursive: true, force: true });
}

async function assertBunUnavailable() {
	const check = await runCommand("bash", ["-lc", "command -v bun"]);
	assert(check.exitCode !== 0, "Expected bun to be unavailable after cleanup");
}

async function getBunInfo() {
	const check = await runCommand("bash", ["-lc", "command -v bun"]);
	if (check.exitCode !== 0) return { available: false, version: "" };
	const version = await runCommand("bun", ["--version"]);
	return { available: true, version: version.stdout.trim() };
}

async function walkFiles(rootDir, options) {
	const files = [];
	const skipDirNames = new Set(options?.skipDirNames ?? []);

	async function walk(currentDir) {
		const entries = await readdir(currentDir, { withFileTypes: true });
		entries.sort((a, b) => a.name.localeCompare(b.name));

		for (const entry of entries) {
			if (entry.isDirectory() && skipDirNames.has(entry.name)) continue;
			const fullPath = join(currentDir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile()) {
				files.push(fullPath);
			}
		}
	}

	if (existsSync(rootDir)) {
		await walk(rootDir);
	}

	return files;
}

async function fileContainsMarker(filePath, marker) {
	try {
		const content = await readFile(filePath, "utf-8");
		return content.includes(marker);
	} catch {
		return false;
	}
}

async function projectContainsMarker(projectDir, marker) {
	const searchRoots = [
		".omni",
		".claude",
		".cursor",
		".opencode",
		"CLAUDE.md",
		"AGENTS.md",
		".mcp.json",
	].map((p) => join(projectDir, p));

	for (const root of searchRoots) {
		if (!existsSync(root)) continue;

		const rootStats = await stat(root);
		if (rootStats.isFile()) {
			if (await fileContainsMarker(root, marker)) return true;
			continue;
		}

		const files = await walkFiles(root, { skipDirNames: ["node_modules", ".git", "capabilities"] });
		for (const filePath of files) {
			if (await fileContainsMarker(filePath, marker)) return true;
		}
	}

	return false;
}

async function readJsonIfExists(path) {
	if (!existsSync(path)) return null;
	const content = await readFile(path, "utf-8");
	return parseJson(content, path);
}

function getOmnidevInvocation({ runner, repoRoot, cliVersion }) {
	if (runner === "local") {
		const cliPath = resolve(repoRoot, "packages/cli/dist/index.js");
		return { command: "bun", baseArgs: [cliPath] };
	}

	if (runner === "local-node") {
		const cliPath = resolve(repoRoot, "packages/cli/dist/index.js");
		return { command: "node", baseArgs: [cliPath] };
	}

	if (runner === "npx") {
		assert(cliVersion, "IT_CLI_VERSION is required for runner=npx");
		return { command: "npx", baseArgs: ["-y", `@omnidev-ai/cli@${cliVersion}`] };
	}

	if (runner === "bunx") {
		assert(cliVersion, "IT_CLI_VERSION is required for runner=bunx");
		return { command: "bunx", baseArgs: [`@omnidev-ai/cli@${cliVersion}`] };
	}

	throw new Error(`Unknown IT_RUNNER: ${runner}`);
}

async function validateProject(caseDef, projectDir, commandLogs) {
	assert(existsSync(join(projectDir, ".omni")), "Expected .omni/ directory to exist");
	assert(
		existsSync(join(projectDir, ".omni", "capabilities")),
		"Expected .omni/capabilities to exist",
	);

	if (caseDef.providers?.includes("claude-code")) {
		assert(existsSync(join(projectDir, "CLAUDE.md")), "Expected CLAUDE.md to exist");
	}

	// Capabilities synced (directories with capability.toml)
	const capsDir = join(projectDir, ".omni", "capabilities");
	const capEntries = existsSync(capsDir)
		? (await readdir(capsDir, { withFileTypes: true }))
				.filter((e) => e.isDirectory())
				.map((e) => e.name)
		: [];

	const syncedCaps = [];
	for (const name of capEntries) {
		const capToml = join(capsDir, name, "capability.toml");
		if (existsSync(capToml)) syncedCaps.push(name);
	}
	syncedCaps.sort();

	for (const expected of caseDef.expectedCapabilities ?? []) {
		assert(
			syncedCaps.includes(expected) || (caseDef.expectedMcpServers ?? []).includes(expected),
			`Expected capability '${expected}' to be present. Found: ${syncedCaps.join(", ") || "(none)"}`,
		);
	}

	// MCP servers
	if (caseDef.expectedMcpServers?.length) {
		const mcpJson = await readJsonIfExists(join(projectDir, ".mcp.json"));
		assert(mcpJson && typeof mcpJson === "object", "Expected .mcp.json to exist and be valid JSON");

		const mcpServers =
			mcpJson?.mcpServers && typeof mcpJson.mcpServers === "object" ? mcpJson.mcpServers : {};

		for (const serverName of caseDef.expectedMcpServers) {
			assert(
				Object.hasOwn(mcpServers, serverName),
				`Expected .mcp.json to include mcpServers.${serverName}`,
			);
		}
	}

	// Markers
	for (const marker of caseDef.expectedMarkers ?? []) {
		const found = await projectContainsMarker(projectDir, marker);
		assert(found, `Expected to find marker '${marker}' in synced output`);
	}

	// No critical "Error:" lines in stderr
	const critical = commandLogs
		.flatMap((l) => l.stderr.split("\n"))
		.map((l) => l.trim())
		.filter(Boolean)
		.filter(
			(line) =>
				line.includes("Error:") && !line.includes("Warning:") && !line.includes("not found"),
		);
	assert(critical.length === 0, `Found critical errors in stderr:\n${critical.join("\n")}`);
}

async function runCase({ caseDef, invocation, repoRoot }) {
	const examplePath = resolve(repoRoot, caseDef.exampleFile);
	const omniToml = await readFile(examplePath, "utf-8");

	const runId = `${caseDef.id}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
	const projectDir = join(tmpdir(), "omnidev-it", runId);
	await mkdir(projectDir, { recursive: true });

	await writeFile(join(projectDir, "omni.toml"), omniToml, "utf-8");

	const providersArg = (caseDef.providers ?? ["claude-code"]).join(",");
	const commandLogs = [];

	// init
	{
		const result = await runCommand(
			invocation.command,
			[...invocation.baseArgs, "init", providersArg],
			{ cwd: projectDir },
		);
		commandLogs.push({ step: "init", ...result });
		assert(
			result.exitCode === 0,
			`omnidev init failed (exit ${result.exitCode})\n${result.stderr}`,
		);
	}

	// sync
	{
		const result = await runCommand(invocation.command, [...invocation.baseArgs, "sync"], {
			cwd: projectDir,
		});
		commandLogs.push({ step: "sync", ...result });
		assert(
			result.exitCode === 0,
			`omnidev sync failed (exit ${result.exitCode})\n${result.stderr}`,
		);
	}

	await validateProject(caseDef, projectDir, commandLogs);

	// Cleanup (best-effort)
	await rm(projectDir, { recursive: true, force: true });
}

const mode = process.env.IT_MODE ?? "dev";
const runner = process.env.IT_RUNNER ?? (mode === "dev" ? "local" : "npx");
const repoRoot = process.cwd();
const cliVersion = process.env.IT_CLI_VERSION ?? "";
const casesFile = process.env.IT_CASES_FILE ?? "tests/integration/cases.json";
let buildInfo = "";

if (runner === "local") {
	// Ensure repo deps + dist are ready in-container.
	const bunCheck = await runCommand("bun", ["--version"]);
	assert(bunCheck.exitCode === 0, "runner=local requires Bun to be installed in the container");

	const install = await runCommand("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], {
		cwd: repoRoot,
	});
	assert(install.exitCode === 0, `bun install failed\n${install.stderr}`);

	const build = await runCommand("bun", ["run", "build"], { cwd: repoRoot });
	assert(build.exitCode === 0, `bun run build failed\n${build.stderr}`);
	buildInfo = "built with system bun";
}

if (runner === "local-node") {
	// Build with a temporary Bun install, then remove it to validate runtime without Bun.
	const { bunInstallDir, bunPath, bunEnv } = await installTempBun();
	try {
		const install = await runCommand(
			bunPath,
			["install", "--frozen-lockfile", "--ignore-scripts"],
			{ cwd: repoRoot, env: bunEnv },
		);
		assert(install.exitCode === 0, `bun install failed\n${install.stderr}`);

		const build = await runCommand(bunPath, ["run", "build"], { cwd: repoRoot, env: bunEnv });
		assert(build.exitCode === 0, `bun run build failed\n${build.stderr}`);
	} finally {
		await removeTempBun(bunInstallDir);
	}

	await assertBunUnavailable();
	buildInfo = "built with temp bun (removed before tests)";
}

if (mode === "release") {
	assert(cliVersion, "IT_CLI_VERSION is required for IT_MODE=release");
}

const casesJson = parseJson(await readFile(resolve(repoRoot, casesFile), "utf-8"), casesFile);
const cases = casesJson.cases ?? [];
assert(Array.isArray(cases) && cases.length > 0, "No cases found in cases.json");

const invocation = getOmnidevInvocation({ runner, repoRoot, cliVersion });
const bunInfo = await getBunInfo();

console.log(`OmniDev Docker Integration`);
console.log(`- mode: ${mode}`);
console.log(`- runner: ${runner}`);
if (cliVersion) console.log(`- cliVersion: ${cliVersion}`);
console.log(`- cases: ${cases.length}`);
if (buildInfo) console.log(`- build: ${buildInfo}`);
console.log(
	`- bun: ${bunInfo.available ? `available (${bunInfo.version || "unknown"})` : "unavailable"}`,
);

for (const caseDef of cases) {
	console.log(`\n==> ${caseDef.id}`);
	await runCase({ caseDef, invocation, repoRoot });
	console.log(`✓ ${caseDef.id}`);
}

console.log("\nAll integration cases passed.");
