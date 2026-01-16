import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	parseSourceConfig,
	sourceToGitUrl,
	getSourceCapabilityPath,
	getLockFilePath,
	loadLockFile,
	saveLockFile,
} from "./sources";
import type { CapabilitiesLockFile, GitCapabilitySourceConfig } from "../types/index.js";

describe("parseSourceConfig", () => {
	test("parses simple github shorthand", () => {
		const config = parseSourceConfig("github:user/repo") as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.ref).toBeUndefined();
	});

	test("parses github shorthand with ref", () => {
		const config = parseSourceConfig("github:user/repo#v1.0.0") as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.ref).toBe("v1.0.0");
	});

	test("parses github shorthand with branch ref", () => {
		const config = parseSourceConfig("github:user/repo#main") as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.ref).toBe("main");
	});

	test("parses github shorthand with commit ref", () => {
		const config = parseSourceConfig("github:user/repo#abc123def") as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.ref).toBe("abc123def");
	});

	test("parses git ssh URL", () => {
		const config = parseSourceConfig("git@github.com:user/repo.git") as GitCapabilitySourceConfig;

		expect(config.source).toBe("git@github.com:user/repo.git");
		expect(config.ref).toBeUndefined();
	});

	test("parses https git URL", () => {
		const config = parseSourceConfig(
			"https://github.com/user/repo.git",
		) as GitCapabilitySourceConfig;

		expect(config.source).toBe("https://github.com/user/repo.git");
		expect(config.ref).toBeUndefined();
	});

	test("passes through full config object", () => {
		const config = parseSourceConfig({
			source: "github:user/repo",
			ref: "v2.0.0",
			type: "wrap",
		}) as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.ref).toBe("v2.0.0");
		expect(config.type).toBe("wrap");
	});

	test("passes through config with path", () => {
		const config = parseSourceConfig({
			source: "github:user/monorepo",
			path: "packages/my-cap",
		}) as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/monorepo");
		expect(config.path).toBe("packages/my-cap");
	});
});

describe("sourceToGitUrl", () => {
	test("converts github shorthand to https URL", () => {
		const url = sourceToGitUrl("github:user/repo");

		expect(url).toBe("https://github.com/user/repo.git");
	});

	test("converts github shorthand with org to https URL", () => {
		const url = sourceToGitUrl("github:my-org/my-repo");

		expect(url).toBe("https://github.com/my-org/my-repo.git");
	});

	test("passes through https URL unchanged", () => {
		const url = sourceToGitUrl("https://github.com/user/repo.git");

		expect(url).toBe("https://github.com/user/repo.git");
	});

	test("passes through ssh URL unchanged", () => {
		const url = sourceToGitUrl("git@github.com:user/repo.git");

		expect(url).toBe("git@github.com:user/repo.git");
	});

	test("passes through gitlab https URL unchanged", () => {
		const url = sourceToGitUrl("https://gitlab.com/user/repo.git");

		expect(url).toBe("https://gitlab.com/user/repo.git");
	});
});

describe("getSourceCapabilityPath", () => {
	test("returns correct path for capability id", () => {
		const path = getSourceCapabilityPath("my-cap");

		expect(path).toBe(".omni/capabilities/my-cap");
	});

	test("handles capability id with hyphens", () => {
		const path = getSourceCapabilityPath("my-awesome-capability");

		expect(path).toBe(".omni/capabilities/my-awesome-capability");
	});
});

describe("getLockFilePath", () => {
	test("returns correct lock file path", () => {
		const path = getLockFilePath();

		expect(path).toBe("omni.lock.toml");
	});
});

describe("loadLockFile", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = mkdtempSync(join(tmpdir(), "test-lock-file-"));
		mkdirSync(join(testDir, ".omni"), { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("returns empty capabilities when lock file does not exist", async () => {
		const lockFile = await loadLockFile();

		expect(lockFile.capabilities).toEqual({});
	});

	test("loads lock file with single capability", async () => {
		writeFileSync(
			"omni.lock.toml",
			`[capabilities.my-cap]
source = "github:user/repo"
version = "1.0.0"
commit = "abc123def456"
updated_at = "2026-01-01T00:00:00Z"
`,
		);

		const lockFile = await loadLockFile();

		expect(lockFile.capabilities["my-cap"]).toBeDefined();
		expect(lockFile.capabilities["my-cap"]?.source).toBe("github:user/repo");
		expect(lockFile.capabilities["my-cap"]?.version).toBe("1.0.0");
		expect(lockFile.capabilities["my-cap"]?.commit).toBe("abc123def456");
	});

	test("loads lock file with multiple capabilities", async () => {
		writeFileSync(
			"omni.lock.toml",
			`[capabilities.cap1]
source = "github:user/repo1"
version = "1.0.0"
commit = "abc123"
updated_at = "2026-01-01T00:00:00Z"

[capabilities.cap2]
source = "github:user/repo2"
version = "2.0.0"
commit = "def456"
ref = "v2.0.0"
updated_at = "2026-01-02T00:00:00Z"
`,
		);

		const lockFile = await loadLockFile();

		expect(Object.keys(lockFile.capabilities)).toHaveLength(2);
		expect(lockFile.capabilities["cap1"]?.version).toBe("1.0.0");
		expect(lockFile.capabilities["cap2"]?.version).toBe("2.0.0");
		expect(lockFile.capabilities["cap2"]?.ref).toBe("v2.0.0");
	});

	test("returns empty capabilities for invalid TOML", async () => {
		writeFileSync("omni.lock.toml", "invalid [[[toml");

		const lockFile = await loadLockFile();

		expect(lockFile.capabilities).toEqual({});
	});
});

describe("saveLockFile", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = mkdtempSync(join(tmpdir(), "test-save-lock-"));
		mkdirSync(join(testDir, ".omni"), { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("creates lock file with single capability", async () => {
		const lockFile: CapabilitiesLockFile = {
			capabilities: {
				"my-cap": {
					source: "github:user/repo",
					version: "1.0.0",
					commit: "abc123",
					updated_at: "2026-01-01T00:00:00Z",
				},
			},
		};

		await saveLockFile(lockFile);

		expect(existsSync("omni.lock.toml")).toBe(true);

		const content = await Bun.file("omni.lock.toml").text();
		expect(content).toContain("[capabilities.my-cap]");
		expect(content).toContain('source = "github:user/repo"');
		expect(content).toContain('version = "1.0.0"');
		expect(content).toContain('commit = "abc123"');
	});

	test("creates lock file with ref when present", async () => {
		const lockFile: CapabilitiesLockFile = {
			capabilities: {
				"pinned-cap": {
					source: "github:user/repo",
					version: "2.0.0",
					commit: "def456",
					ref: "v2.0.0",
					updated_at: "2026-01-01T00:00:00Z",
				},
			},
		};

		await saveLockFile(lockFile);

		const content = await Bun.file("omni.lock.toml").text();
		expect(content).toContain('ref = "v2.0.0"');
	});

	test("creates capabilities directory if it does not exist", async () => {
		rmSync(".omni/capabilities", { recursive: true, force: true });

		const lockFile: CapabilitiesLockFile = {
			capabilities: {
				test: {
					source: "github:user/repo",
					version: "1.0.0",
					updated_at: "2026-01-01T00:00:00Z",
				},
			},
		};

		await saveLockFile(lockFile);

		expect(existsSync(".omni/capabilities")).toBe(true);
		expect(existsSync("omni.lock.toml")).toBe(true);
	});

	test("includes header comment in lock file", async () => {
		const lockFile: CapabilitiesLockFile = {
			capabilities: {},
		};

		await saveLockFile(lockFile);

		const content = await Bun.file("omni.lock.toml").text();
		expect(content).toContain("# Auto-generated by OmniDev");
		expect(content).toContain("DO NOT EDIT");
	});

	test("roundtrip: save and load produces same data", async () => {
		const original: CapabilitiesLockFile = {
			capabilities: {
				cap1: {
					source: "github:user/repo1",
					version: "1.0.0",
					commit: "abc123",
					updated_at: "2026-01-01T00:00:00Z",
				},
				cap2: {
					source: "github:user/repo2",
					version: "2.0.0",
					commit: "def456",
					ref: "v2.0.0",
					updated_at: "2026-01-02T00:00:00Z",
				},
			},
		};

		await saveLockFile(original);
		const loaded = await loadLockFile();

		expect(loaded.capabilities["cap1"]?.source).toBe(original.capabilities["cap1"]?.source);
		expect(loaded.capabilities["cap1"]?.version).toBe(original.capabilities["cap1"]?.version);
		expect(loaded.capabilities["cap1"]?.commit).toBe(original.capabilities["cap1"]?.commit);
		expect(loaded.capabilities["cap2"]?.ref).toBe(original.capabilities["cap2"]?.ref);
	});
});

// Note: Tests for fetchCapabilitySource and fetchAllCapabilitySources require
// network access and git operations. These should be tested via integration tests
// or with mocked git commands. The manual test in /tmp/omni-test verified the
// full flow works correctly with the real obsidian-skills repository.
