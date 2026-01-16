import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runInit } from "./init";

describe("init command", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = join(import.meta.dir, `test-init-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("creates .omni/ directory", async () => {
		await runInit({}, "claude");

		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".omni/capabilities")).toBe(true);
	});

	test("creates omni.toml with default config", async () => {
		await runInit({}, "claude");

		expect(existsSync("omni.toml")).toBe(true);

		const content = readFileSync("omni.toml", "utf-8");
		expect(content).toContain('project = "my-project"');
		// active_profile is stored in state file, not config.toml
		expect(content).not.toContain("active_profile");
		// profiles should be in config.toml
		expect(content).toContain("[profiles.default]");
		expect(content).toContain("[profiles.planning]");
		expect(content).toContain("[profiles.coding]");
		// providers should be in config.toml
		expect(content).toContain("[providers]");
		// should have documentation comments
		expect(content).toContain("# OmniDev Configuration");
	});

	test("creates active profile in state file", async () => {
		await runInit({}, "claude");

		expect(existsSync(".omni/state/active-profile")).toBe(true);

		const content = readFileSync(".omni/state/active-profile", "utf-8");
		expect(content).toBe("default");
	});

	test("does not create separate capabilities.toml file", async () => {
		await runInit({}, "claude");

		// All config is unified in config.toml
		expect(existsSync(".omni/capabilities.toml")).toBe(false);
	});

	test("does not create separate profiles.toml file", async () => {
		await runInit({}, "claude");

		// Profiles are in config.toml
		expect(existsSync(".omni/profiles.toml")).toBe(false);
	});

	test("creates .omni/ directory with subdirectories", async () => {
		await runInit({}, "claude");

		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".omni/state")).toBe(true);
		expect(existsSync(".omni/sandbox")).toBe(true);
	});

	test("does not create separate provider.toml file", async () => {
		await runInit({}, "claude");

		// Providers are in config.toml
		expect(existsSync(".omni/provider.toml")).toBe(false);

		// Verify provider is in config.toml instead
		const content = readFileSync("omni.toml", "utf-8");
		expect(content).toContain('enabled = ["claude"]');
	});

	test("creates AGENTS.md for Codex provider", async () => {
		await runInit({}, "codex");

		expect(existsSync("AGENTS.md")).toBe(true);

		const content = readFileSync("AGENTS.md", "utf-8");
		expect(content).toContain("# Project Instructions");
		expect(content).toContain("@import .omni/instructions.md");
	});

	test("creates .omni/instructions.md", async () => {
		await runInit({}, "codex");

		expect(existsSync(".omni/instructions.md")).toBe(true);

		const content = readFileSync(".omni/instructions.md", "utf-8");
		expect(content).toContain("# OmniDev Instructions");
		expect(content).toContain("## Project Description");
		expect(content).toContain("<!-- TODO: Add 2-3 sentences describing your project -->");
		expect(content).toContain("## Capabilities");
		expect(content).toContain("No capabilities enabled yet");
	});

	test("does not create AGENTS.md for Claude provider", async () => {
		await runInit({}, "claude");

		expect(existsSync("AGENTS.md")).toBe(false);
	});

	test("creates CLAUDE.md for Claude provider", async () => {
		await runInit({}, "claude");

		expect(existsSync("CLAUDE.md")).toBe(true);

		const content = readFileSync("CLAUDE.md", "utf-8");
		expect(content).toContain("# Project Instructions");
		expect(content).toContain("@import .omni/instructions.md");
	});

	test("does not create CLAUDE.md for Codex provider", async () => {
		await runInit({}, "codex");

		expect(existsSync("CLAUDE.md")).toBe(false);
	});

	test("creates both AGENTS.md and CLAUDE.md for 'both' providers", async () => {
		await runInit({}, "both");

		expect(existsSync("AGENTS.md")).toBe(true);
		expect(existsSync("CLAUDE.md")).toBe(true);

		const agentsContent = readFileSync("AGENTS.md", "utf-8");
		expect(agentsContent).toContain("# Project Instructions");
		expect(agentsContent).toContain("@import .omni/instructions.md");

		const claudeContent = readFileSync("CLAUDE.md", "utf-8");
		expect(claudeContent).toContain("# Project Instructions");
		expect(claudeContent).toContain("@import .omni/instructions.md");
	});

	test("does not modify existing CLAUDE.md", async () => {
		const existingContent = "# My Existing Config\n\nExisting content here.\n";
		await Bun.write("CLAUDE.md", existingContent);

		await runInit({}, "claude");

		const content = readFileSync("CLAUDE.md", "utf-8");
		expect(content).toBe(existingContent);
	});

	test("does not modify existing AGENTS.md", async () => {
		const existingContent = "# My Existing Agents\n\nExisting content here.\n";
		await Bun.write("AGENTS.md", existingContent);

		await runInit({}, "codex");

		const content = readFileSync("AGENTS.md", "utf-8");
		expect(content).toBe(existingContent);
	});

	test("creates .omni/.gitignore with internal patterns", async () => {
		await runInit({}, "claude");

		expect(existsSync(".omni/.gitignore")).toBe(true);

		const content = readFileSync(".omni/.gitignore", "utf-8");
		expect(content).toContain("# OmniDev working files - always ignored");
		expect(content).toContain(".env");
		expect(content).toContain("state/");
		expect(content).toContain("sandbox/");
		expect(content).toContain("*.log");
	});

	test("does not modify project's root .gitignore", async () => {
		// Create a root .gitignore with custom content
		await Bun.write(".gitignore", "node_modules/\n*.log\n");

		await runInit({}, "claude");

		// Verify .gitignore was not modified
		const content = readFileSync(".gitignore", "utf-8");
		expect(content).toBe("node_modules/\n*.log\n");
		expect(content).not.toContain(".omni/");
	});

	test("does not create root .gitignore if it doesn't exist", async () => {
		await runInit({}, "claude");

		expect(existsSync(".gitignore")).toBe(false);
	});

	test("is idempotent - safe to run multiple times", async () => {
		await runInit({}, "claude");
		await runInit({}, "claude");
		await runInit({}, "claude");

		expect(existsSync("omni.toml")).toBe(true);
		expect(existsSync(".omni")).toBe(true);
		expect(existsSync("CLAUDE.md")).toBe(true);

		// Should not create AGENTS.md for Claude
		expect(existsSync("AGENTS.md")).toBe(false);
	});

	test("does not overwrite existing config.toml", async () => {
		const customConfig = 'project = "custom"\n';
		mkdirSync(".omni", { recursive: true });
		await Bun.write("omni.toml", customConfig);

		await runInit({}, "claude");

		const content = readFileSync("omni.toml", "utf-8");
		expect(content).toBe(customConfig);
	});

	test("does not overwrite existing AGENTS.md", async () => {
		const customAgents = "# Custom agents\n";
		await Bun.write("AGENTS.md", customAgents);

		await runInit({}, "codex");

		const content = readFileSync("AGENTS.md", "utf-8");
		expect(content).toBe(customAgents);
	});

	test("creates all directories even if some already exist", async () => {
		mkdirSync(".omni", { recursive: true });

		await runInit({}, "claude");

		expect(existsSync(".omni/capabilities")).toBe(true);
		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".omni/state")).toBe(true);
		expect(existsSync(".omni/sandbox")).toBe(true);
	});

	test("accepts provider via positional parameter", async () => {
		await runInit({}, "codex");

		expect(existsSync(".omni/provider.toml")).toBe(false);

		const content = readFileSync("omni.toml", "utf-8");
		expect(content).toContain('enabled = ["codex"]');
	});

	test("accepts 'both' as provider parameter", async () => {
		await runInit({}, "both");

		expect(existsSync(".omni/provider.toml")).toBe(false);

		const content = readFileSync("omni.toml", "utf-8");
		expect(content).toContain('enabled = ["claude", "codex"]');
	});
});
