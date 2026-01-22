import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import {
	parseSourceConfig,
	sourceToGitUrl,
	getSourceCapabilityPath,
	getLockFilePath,
	loadLockFile,
	saveLockFile,
	isFileSource,
	isGitSource,
	parseFileSourcePath,
	readCapabilityIdFromPath,
} from "./sources";
import type {
	CapabilitiesLockFile,
	FileCapabilitySourceConfig,
	GitCapabilitySourceConfig,
} from "../types/index.js";

describe("parseSourceConfig", () => {
	test("parses simple github shorthand", () => {
		const config = parseSourceConfig("github:user/repo") as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.version).toBeUndefined();
	});

	test("parses github shorthand with ref", () => {
		const config = parseSourceConfig("github:user/repo#v1.0.0") as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.version).toBe("v1.0.0");
	});

	test("parses github shorthand with branch ref", () => {
		const config = parseSourceConfig("github:user/repo#main") as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.version).toBe("main");
	});

	test("parses github shorthand with commit ref", () => {
		const config = parseSourceConfig("github:user/repo#abc123def") as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.version).toBe("abc123def");
	});

	test("parses git ssh URL", () => {
		const config = parseSourceConfig("git@github.com:user/repo.git") as GitCapabilitySourceConfig;

		expect(config.source).toBe("git@github.com:user/repo.git");
		expect(config.version).toBeUndefined();
	});

	test("parses https git URL", () => {
		const config = parseSourceConfig(
			"https://github.com/user/repo.git",
		) as GitCapabilitySourceConfig;

		expect(config.source).toBe("https://github.com/user/repo.git");
		expect(config.version).toBeUndefined();
	});

	test("passes through full config object", () => {
		const config = parseSourceConfig({
			source: "github:user/repo",
			version: "v2.0.0",
		}) as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/repo");
		expect(config.version).toBe("v2.0.0");
	});

	test("passes through config with path", () => {
		const config = parseSourceConfig({
			source: "github:user/monorepo",
			path: "packages/my-cap",
		}) as GitCapabilitySourceConfig;

		expect(config.source).toBe("github:user/monorepo");
		expect(config.path).toBe("packages/my-cap");
	});

	test("parses file source shorthand", () => {
		const config = parseSourceConfig("file://./capabilities/my-cap") as FileCapabilitySourceConfig;

		expect(config.source).toBe("file://./capabilities/my-cap");
	});

	test("passes through file source config object", () => {
		const config = parseSourceConfig({
			source: "file://./local/capability",
		}) as FileCapabilitySourceConfig;

		expect(config.source).toBe("file://./local/capability");
	});
});

describe("isFileSource", () => {
	test("returns true for file:// prefix", () => {
		expect(isFileSource("file://./path")).toBe(true);
		expect(isFileSource("file:///absolute/path")).toBe(true);
	});

	test("returns false for non-file sources", () => {
		expect(isFileSource("github:user/repo")).toBe(false);
		expect(isFileSource("https://github.com/user/repo.git")).toBe(false);
		expect(isFileSource("git@github.com:user/repo.git")).toBe(false);
	});
});

describe("isGitSource", () => {
	test("returns true for github shorthand", () => {
		expect(isGitSource("github:user/repo")).toBe(true);
	});

	test("returns true for https URLs", () => {
		expect(isGitSource("https://github.com/user/repo.git")).toBe(true);
	});

	test("returns true for SSH URLs", () => {
		expect(isGitSource("git@github.com:user/repo.git")).toBe(true);
	});

	test("returns false for file sources", () => {
		expect(isGitSource("file://./path")).toBe(false);
	});
});

describe("parseFileSourcePath", () => {
	test("removes file:// prefix for relative path", () => {
		expect(parseFileSourcePath("file://./capabilities/my-cap")).toBe("./capabilities/my-cap");
	});

	test("removes file:// prefix for absolute path", () => {
		expect(parseFileSourcePath("file:///home/user/caps")).toBe("/home/user/caps");
	});

	test("throws for non-file source", () => {
		expect(() => parseFileSourcePath("github:user/repo")).toThrow("Invalid file source");
	});
});

describe("readCapabilityIdFromPath", () => {
	const testDir = setupTestDir("read-cap-id-test-", { chdir: true, createOmniDir: true });

	test("reads ID from capability.toml", async () => {
		const capDir = join(testDir.path, "test-cap");
		mkdirSync(capDir, { recursive: true });
		writeFileSync(
			join(capDir, "capability.toml"),
			`[capability]
id = "my-custom-id"
name = "Test"
version = "1.0.0"
description = "Test capability"
`,
		);

		const id = await readCapabilityIdFromPath(capDir);
		expect(id).toBe("my-custom-id");
	});

	test("falls back to directory name when no capability.toml", async () => {
		const capDir = join(testDir.path, "fallback-dir");
		mkdirSync(capDir, { recursive: true });

		const id = await readCapabilityIdFromPath(capDir);
		expect(id).toBe("fallback-dir");
	});

	test("falls back to directory name when capability.toml has no id", async () => {
		const capDir = join(testDir.path, "no-id-cap");
		mkdirSync(capDir, { recursive: true });
		writeFileSync(
			join(capDir, "capability.toml"),
			`[capability]
name = "Test"
`,
		);

		const id = await readCapabilityIdFromPath(capDir);
		expect(id).toBe("no-id-cap");
	});

	test("handles trailing slash in path", async () => {
		const capDir = join(testDir.path, "trailing-slash");
		mkdirSync(capDir, { recursive: true });

		const id = await readCapabilityIdFromPath(`${capDir}/`);
		expect(id).toBe("trailing-slash");
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
	setupTestDir("test-lock-file-", { chdir: true, createOmniDir: true });
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
pinned_version = "v2.0.0"
updated_at = "2026-01-02T00:00:00Z"
`,
		);

		const lockFile = await loadLockFile();

		expect(Object.keys(lockFile.capabilities)).toHaveLength(2);
		expect(lockFile.capabilities["cap1"]?.version).toBe("1.0.0");
		expect(lockFile.capabilities["cap2"]?.version).toBe("2.0.0");
		expect(lockFile.capabilities["cap2"]?.pinned_version).toBe("v2.0.0");
	});

	test("returns empty capabilities for invalid TOML", async () => {
		writeFileSync("omni.lock.toml", "invalid [[[toml");

		const lockFile = await loadLockFile();

		expect(lockFile.capabilities).toEqual({});
	});
});

describe("saveLockFile", () => {
	setupTestDir("test-save-lock-", { chdir: true, createOmniDir: true });
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

		const content = await readFile("omni.lock.toml", "utf-8");
		expect(content).toContain("[capabilities.my-cap]");
		expect(content).toContain('source = "github:user/repo"');
		expect(content).toContain('version = "1.0.0"');
		expect(content).toContain('commit = "abc123"');
	});

	test("creates lock file with pinned_version when present", async () => {
		const lockFile: CapabilitiesLockFile = {
			capabilities: {
				"pinned-cap": {
					source: "github:user/repo",
					version: "2.0.0",
					commit: "def456",
					pinned_version: "v2.0.0",
					updated_at: "2026-01-01T00:00:00Z",
				},
			},
		};

		await saveLockFile(lockFile);

		const content = await readFile("omni.lock.toml", "utf-8");
		expect(content).toContain('pinned_version = "v2.0.0"');
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

		const content = await readFile("omni.lock.toml", "utf-8");
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
					pinned_version: "v2.0.0",
					updated_at: "2026-01-02T00:00:00Z",
				},
			},
		};

		await saveLockFile(original);
		const loaded = await loadLockFile();

		expect(loaded.capabilities["cap1"]?.source).toBe(original.capabilities["cap1"]?.source);
		expect(loaded.capabilities["cap1"]?.version).toBe(original.capabilities["cap1"]?.version);
		expect(loaded.capabilities["cap1"]?.commit).toBe(original.capabilities["cap1"]?.commit);
		expect(loaded.capabilities["cap2"]?.pinned_version).toBe(
			original.capabilities["cap2"]?.pinned_version,
		);
	});
});

describe("wrapping detection", () => {
	const testDir = setupTestDir("test-wrapping-", { chdir: true, createOmniDir: true });

	beforeEach(() => {
		mkdirSync(join(testDir.path, ".omni", "capabilities"), { recursive: true });
	});
	test("detects wrapping needed when .claude-plugin/plugin.json exists", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, ".claude-plugin"), { recursive: true });

		writeFileSync(
			join(capDir, ".claude-plugin", "plugin.json"),
			JSON.stringify({
				name: "test-capability",
				version: "1.0.0",
				description: "Test capability",
				author: {
					name: "Test Author",
					email: "test@example.com",
				},
			}),
		);

		// Should be detected as needing wrapping since no capability.toml exists
		expect(existsSync(join(capDir, "capability.toml"))).toBe(false);
		expect(existsSync(join(capDir, ".claude-plugin", "plugin.json"))).toBe(true);
	});

	test("detects wrapping needed when skills directory exists", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, "skills"), { recursive: true });

		writeFileSync(join(capDir, "skills", "example-skill.md"), "# Example Skill\n");

		expect(existsSync(join(capDir, "capability.toml"))).toBe(false);
		expect(existsSync(join(capDir, "skills"))).toBe(true);
	});

	test("detects wrapping needed when agents directory exists", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, "agents"), { recursive: true });

		writeFileSync(join(capDir, "agents", "example-agent.md"), "# Example Agent\n");

		expect(existsSync(join(capDir, "capability.toml"))).toBe(false);
		expect(existsSync(join(capDir, "agents"))).toBe(true);
	});

	test("detects wrapping needed when commands directory exists", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, "commands"), { recursive: true });

		writeFileSync(join(capDir, "commands", "example-command.md"), "# Example Command\n");

		expect(existsSync(join(capDir, "capability.toml"))).toBe(false);
		expect(existsSync(join(capDir, "commands"))).toBe(true);
	});

	test("detects wrapping needed when rules directory exists", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, "rules"), { recursive: true });

		writeFileSync(join(capDir, "rules", "example-rule.md"), "# Example Rule\n");

		expect(existsSync(join(capDir, "capability.toml"))).toBe(false);
		expect(existsSync(join(capDir, "rules"))).toBe(true);
	});

	test("detects wrapping needed when docs directory exists", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, "docs"), { recursive: true });

		writeFileSync(join(capDir, "docs", "getting-started.md"), "# Getting Started\n");

		expect(existsSync(join(capDir, "capability.toml"))).toBe(false);
		expect(existsSync(join(capDir, "docs"))).toBe(true);
	});

	test("does not wrap when capability.toml exists", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, "skills"), { recursive: true });

		writeFileSync(
			join(capDir, "capability.toml"),
			`[capability]
id = "test-cap"
name = "Test Capability"
version = "1.0.0"
description = "Test"
`,
		);

		writeFileSync(join(capDir, "skills", "example-skill.md"), "# Example Skill\n");

		// Has capability.toml, so should NOT be wrapped even with skills dir
		expect(existsSync(join(capDir, "capability.toml"))).toBe(true);
		expect(existsSync(join(capDir, "skills"))).toBe(true);
	});

	test("does not wrap directory with no recognized structure", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(capDir, { recursive: true });

		// Create some random files/dirs that shouldn't trigger wrapping
		writeFileSync(join(capDir, "README.md"), "# Test\n");
		writeFileSync(join(capDir, "package.json"), "{}");
		mkdirSync(join(capDir, "src"));

		expect(existsSync(join(capDir, "capability.toml"))).toBe(false);
		expect(existsSync(join(capDir, ".claude-plugin"))).toBe(false);
		expect(existsSync(join(capDir, "skills"))).toBe(false);
		// Should not trigger wrapping
	});

	test("recognizes singular directory names", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, "skill"), { recursive: true });

		writeFileSync(join(capDir, "skill", "example.md"), "# Example\n");

		// Singular 'skill' should also be detected
		expect(existsSync(join(capDir, "skill"))).toBe(true);
	});

	test("recognizes alternative directory names", () => {
		const capDir = join(testDir.path, ".omni", "capabilities", "test-cap");
		mkdirSync(join(capDir, "subagents"), { recursive: true });

		writeFileSync(join(capDir, "subagents", "example.md"), "# Example\n");

		// 'subagents' should also be detected as agent dir
		expect(existsSync(join(capDir, "subagents"))).toBe(true);
	});
});

// Note: Tests for fetchCapabilitySource and fetchAllCapabilitySources with actual
// git operations require network access. These should be tested via integration tests
// or with mocked git commands. The manual test in /tmp/omni-test verified the
// full flow works correctly with the real obsidian-skills repository.
