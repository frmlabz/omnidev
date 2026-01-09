import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
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

	test("creates omni/ directory", async () => {
		await runInit({}, "claude");

		expect(existsSync("omni")).toBe(true);
		expect(existsSync("omni/capabilities")).toBe(true);
	});

	test("creates omni/config.toml with default config", async () => {
		await runInit({}, "claude");

		expect(existsSync("omni/config.toml")).toBe(true);

		const content = readFileSync("omni/config.toml", "utf-8");
		expect(content).toContain('project = "my-project"');
		expect(content).toContain('default_profile = "default"');
		expect(content).toContain("[capabilities]");
		expect(content).toContain("[profiles.default]");
	});

	test("creates .omni/ directory with subdirectories", async () => {
		await runInit({}, "claude");

		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".omni/generated")).toBe(true);
		expect(existsSync(".omni/state")).toBe(true);
		expect(existsSync(".omni/sandbox")).toBe(true);
	});

	test("creates .omni/provider.toml with selected provider", async () => {
		await runInit({}, "claude");

		expect(existsSync(".omni/provider.toml")).toBe(true);

		const content = readFileSync(".omni/provider.toml", "utf-8");
		expect(content).toContain('provider = "claude"');
	});

	test("creates AGENTS.md for Codex provider", async () => {
		await runInit({}, "codex");

		expect(existsSync("AGENTS.md")).toBe(true);

		const content = readFileSync("AGENTS.md", "utf-8");
		expect(content).toContain("# Project Instructions");
		expect(content).toContain("## Project Description");
		expect(content).toContain("<!-- TODO: Add 2-3 sentences describing your project -->");
		expect(content).toContain("@import .omni/generated/rules.md");
	});

	test("does not create AGENTS.md for Claude provider", async () => {
		await runInit({}, "claude");

		expect(existsSync("AGENTS.md")).toBe(false);
	});

	test("creates .claude/claude.md for Claude provider", async () => {
		await runInit({}, "claude");

		expect(existsSync(".claude")).toBe(true);
		expect(existsSync(".claude/claude.md")).toBe(true);

		const content = readFileSync(".claude/claude.md", "utf-8");
		expect(content).toContain("# Project Instructions");
		expect(content).toContain("## Project Description");
		expect(content).toContain("<!-- TODO: Add 2-3 sentences describing your project -->");
		expect(content).toContain("@import .omni/generated/rules.md");
	});

	test("does not create .claude/claude.md for Codex provider", async () => {
		await runInit({}, "codex");

		expect(existsSync(".claude")).toBe(false);
	});

	test("creates both AGENTS.md and claude.md for 'both' providers", async () => {
		await runInit({}, "both");

		expect(existsSync("AGENTS.md")).toBe(true);
		expect(existsSync(".claude/claude.md")).toBe(true);

		const agentsContent = readFileSync("AGENTS.md", "utf-8");
		expect(agentsContent).toContain("# Project Instructions");

		const claudeContent = readFileSync(".claude/claude.md", "utf-8");
		expect(claudeContent).toContain("# Project Instructions");
	});

	test("appends to existing .claude/claude.md", async () => {
		mkdirSync(".claude", { recursive: true });
		await Bun.write(".claude/claude.md", "# My Existing Config\n\nExisting content here.\n");

		await runInit({}, "claude");

		const content = readFileSync(".claude/claude.md", "utf-8");
		expect(content).toContain("# My Existing Config");
		expect(content).toContain("Existing content here");
		expect(content).toContain("---");
		expect(content).toContain("# OmniDev Configuration");
		expect(content).toContain("## Project Description");
	});

	test("does not duplicate OmniDev section when appending to claude.md", async () => {
		mkdirSync(".claude", { recursive: true });
		await Bun.write(".claude/claude.md", "# My Config\n\n---\n\n# OmniDev Configuration\n");

		await runInit({}, "claude");

		const content = readFileSync(".claude/claude.md", "utf-8");
		const matches = content.match(/# OmniDev Configuration/g);
		expect(matches?.length).toBe(1);
	});

	test("creates .gitignore with OmniDev entries when file does not exist", async () => {
		await runInit({}, "claude");

		expect(existsSync(".gitignore")).toBe(true);

		const content = readFileSync(".gitignore", "utf-8");
		expect(content).toContain(".omni/");
		expect(content).toContain(".claude/skills/");
		expect(content).toContain(".cursor/rules/omnidev-*.mdc");
	});

	test("appends to .gitignore when file exists", async () => {
		await Bun.write(".gitignore", "node_modules/\n");

		await runInit({}, "claude");

		const content = readFileSync(".gitignore", "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain(".omni/");
		expect(content).toContain(".claude/skills/");
	});

	test("does not duplicate .gitignore entries on re-run", async () => {
		await runInit({}, "claude");
		await runInit({}, "claude");

		const content = readFileSync(".gitignore", "utf-8");
		const matches = content.match(/.omni\//g);
		expect(matches?.length).toBe(1);
	});

	test("is idempotent - safe to run multiple times", async () => {
		await runInit({}, "claude");
		await runInit({}, "claude");
		await runInit({}, "claude");

		expect(existsSync("omni/config.toml")).toBe(true);
		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".claude/claude.md")).toBe(true);

		// Should not create AGENTS.md for Claude
		expect(existsSync("AGENTS.md")).toBe(false);
	});

	test("does not overwrite existing config.toml", async () => {
		const customConfig = 'project = "custom"\n';
		mkdirSync("omni", { recursive: true });
		await Bun.write("omni/config.toml", customConfig);

		await runInit({}, "claude");

		const content = readFileSync("omni/config.toml", "utf-8");
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
		mkdirSync("omni", { recursive: true });

		await runInit({}, "claude");

		expect(existsSync("omni/capabilities")).toBe(true);
		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".omni/generated")).toBe(true);
		expect(existsSync(".omni/state")).toBe(true);
		expect(existsSync(".omni/sandbox")).toBe(true);
	});

	test("accepts provider via positional parameter", async () => {
		await runInit({}, "codex");

		expect(existsSync(".omni/provider.toml")).toBe(true);

		const content = readFileSync(".omni/provider.toml", "utf-8");
		expect(content).toContain('provider = "codex"');
	});

	test("accepts 'both' as provider parameter", async () => {
		await runInit({}, "both");

		expect(existsSync(".omni/provider.toml")).toBe(true);

		const content = readFileSync(".omni/provider.toml", "utf-8");
		expect(content).toContain('providers = ["claude", "codex"]');
	});
});
