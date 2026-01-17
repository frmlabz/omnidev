import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { runInit } from "./init";

describe("init command", () => {
	setupTestDir("init-test-", { chdir: true });

	test("creates .omni/ directory", async () => {
		await runInit({}, "claude-code");

		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".omni/capabilities")).toBe(true);
	});

	test("creates omni.toml with default config", async () => {
		await runInit({}, "claude-code");

		expect(existsSync("omni.toml")).toBe(true);

		const content = readFileSync("omni.toml", "utf-8");
		expect(content).toContain('project = "my-project"');
		// active_profile is stored in state file, not config.toml
		expect(content).not.toContain("active_profile");
		// profiles should be in config.toml
		expect(content).toContain("[profiles.default]");
		expect(content).toContain("[profiles.planning]");
		expect(content).toContain("[profiles.coding]");
		// providers are stored in local state, not config.toml
		expect(content).not.toContain("[providers]");
		// should have documentation comments
		expect(content).toContain("# OmniDev Configuration");
	});

	test("creates active profile in state file", async () => {
		await runInit({}, "claude-code");

		expect(existsSync(".omni/state/active-profile")).toBe(true);

		const content = readFileSync(".omni/state/active-profile", "utf-8");
		expect(content).toBe("default");
	});

	test("stores enabled providers in local state file", async () => {
		await runInit({}, "claude-code");

		expect(existsSync(".omni/state/providers.json")).toBe(true);

		const content = readFileSync(".omni/state/providers.json", "utf-8");
		const state = JSON.parse(content);
		expect(state.enabled).toContain("claude-code");
	});

	test("does not create separate capabilities.toml file", async () => {
		await runInit({}, "claude-code");

		// All config is unified in config.toml
		expect(existsSync(".omni/capabilities.toml")).toBe(false);
	});

	test("does not create separate profiles.toml file", async () => {
		await runInit({}, "claude-code");

		// Profiles are in config.toml
		expect(existsSync(".omni/profiles.toml")).toBe(false);
	});

	test("creates .omni/ directory with subdirectories", async () => {
		await runInit({}, "claude-code");

		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".omni/state")).toBe(true);
	});

	test("does not create separate provider.toml file", async () => {
		await runInit({}, "claude-code");

		// Provider state is in .omni/state/providers.json
		expect(existsSync(".omni/provider.toml")).toBe(false);

		// Verify provider is in state file instead
		const content = readFileSync(".omni/state/providers.json", "utf-8");
		const state = JSON.parse(content);
		expect(state.enabled).toContain("claude-code");
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

	test("does not create AGENTS.md for Claude Code provider", async () => {
		await runInit({}, "claude-code");

		expect(existsSync("AGENTS.md")).toBe(false);
	});

	test("creates CLAUDE.md for Claude Code provider", async () => {
		await runInit({}, "claude-code");

		expect(existsSync("CLAUDE.md")).toBe(true);

		const content = readFileSync("CLAUDE.md", "utf-8");
		expect(content).toContain("# Project Instructions");
		expect(content).toContain("@import .omni/instructions.md");
	});

	test("does not create CLAUDE.md for Codex provider", async () => {
		await runInit({}, "codex");

		expect(existsSync("CLAUDE.md")).toBe(false);
	});

	test("creates both CLAUDE.md and .cursor/rules/ for 'both' providers", async () => {
		// "both" maps to claude-code and cursor
		await runInit({}, "both");

		expect(existsSync("CLAUDE.md")).toBe(true);
		expect(existsSync(".cursor/rules")).toBe(true);

		const claudeContent = readFileSync("CLAUDE.md", "utf-8");
		expect(claudeContent).toContain("# Project Instructions");
		expect(claudeContent).toContain("@import .omni/instructions.md");
	});

	test("does not modify existing CLAUDE.md", async () => {
		const existingContent = "# My Existing Config\n\nExisting content here.\n";
		await Bun.write("CLAUDE.md", existingContent);

		await runInit({}, "claude-code");

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

	test("does not create .omni/.gitignore", async () => {
		await runInit({}, "claude-code");

		// The whole .omni/ directory is gitignored, no need for internal .gitignore
		expect(existsSync(".omni/.gitignore")).toBe(false);
	});

	test("updates root .gitignore with omnidev entries", async () => {
		// Create a root .gitignore with custom content
		await Bun.write(".gitignore", "node_modules/\n*.log\n");

		await runInit({}, "claude-code");

		const content = readFileSync(".gitignore", "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain("*.log");
		expect(content).toContain("# OmniDev");
		expect(content).toContain(".omni/");
		expect(content).toContain("omni.local.toml");
	});

	test("creates root .gitignore if it doesn't exist", async () => {
		await runInit({}, "claude-code");

		expect(existsSync(".gitignore")).toBe(true);

		const content = readFileSync(".gitignore", "utf-8");
		expect(content).toContain("# OmniDev");
		expect(content).toContain(".omni/");
		expect(content).toContain("omni.local.toml");
	});

	test("does not duplicate gitignore entries on multiple runs", async () => {
		await runInit({}, "claude-code");
		await runInit({}, "claude-code");

		const content = readFileSync(".gitignore", "utf-8");
		// Should only have one occurrence of each entry
		expect(content.match(/\.omni\//g)?.length).toBe(1);
		expect(content.match(/omni\.local\.toml/g)?.length).toBe(1);
	});

	test("is idempotent - safe to run multiple times", async () => {
		await runInit({}, "claude-code");
		await runInit({}, "claude-code");
		await runInit({}, "claude-code");

		expect(existsSync("omni.toml")).toBe(true);
		expect(existsSync(".omni")).toBe(true);
		expect(existsSync("CLAUDE.md")).toBe(true);

		// Should not create AGENTS.md for Claude Code
		expect(existsSync("AGENTS.md")).toBe(false);
	});

	test("does not overwrite existing config.toml", async () => {
		const customConfig = 'project = "custom"\n';
		mkdirSync(".omni", { recursive: true });
		await Bun.write("omni.toml", customConfig);

		await runInit({}, "claude-code");

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

		await runInit({}, "claude-code");

		expect(existsSync(".omni/capabilities")).toBe(true);
		expect(existsSync(".omni")).toBe(true);
		expect(existsSync(".omni/state")).toBe(true);
	});

	test("accepts provider via positional parameter", async () => {
		await runInit({}, "codex");

		expect(existsSync(".omni/provider.toml")).toBe(false);

		const content = readFileSync(".omni/state/providers.json", "utf-8");
		const state = JSON.parse(content);
		expect(state.enabled).toContain("codex");
	});

	test("accepts 'both' as provider parameter", async () => {
		await runInit({}, "both");

		expect(existsSync(".omni/provider.toml")).toBe(false);

		const content = readFileSync(".omni/state/providers.json", "utf-8");
		const state = JSON.parse(content);
		// "both" maps to claude-code and cursor
		expect(state.enabled).toContain("claude-code");
		expect(state.enabled).toContain("cursor");
	});

	test("supports legacy 'claude' name mapping to claude-code", async () => {
		await runInit({}, "claude");

		const content = readFileSync(".omni/state/providers.json", "utf-8");
		const state = JSON.parse(content);
		expect(state.enabled).toContain("claude-code");
	});

	test("supports comma-separated providers", async () => {
		await runInit({}, "claude-code,codex,cursor");

		const content = readFileSync(".omni/state/providers.json", "utf-8");
		const state = JSON.parse(content);
		expect(state.enabled).toContain("claude-code");
		expect(state.enabled).toContain("codex");
		expect(state.enabled).toContain("cursor");
	});
});
