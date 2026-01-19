import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "@omnidev-ai/core/test-utils";
import {
	loadHooksFromCapability,
	loadCapabilityHooks,
	hasHooks,
	getHooksDirectory,
	getHooksConfigPath,
} from "./loader.js";

describe("hooks loader", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = tmpdir("hooks-loader-test-");
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	function createHooksConfig(content: string): void {
		const hooksDir = join(testDir, "hooks");
		mkdirSync(hooksDir, { recursive: true });
		writeFileSync(join(hooksDir, "hooks.toml"), content);
	}

	describe("loadHooksFromCapability", () => {
		test("returns empty config for missing hooks folder", () => {
			const result = loadHooksFromCapability(testDir);
			expect(result.found).toBe(false);
			expect(result.config).toEqual({});
			expect(result.validation.valid).toBe(true);
		});

		test("returns empty config for missing hooks.toml", () => {
			const hooksDir = join(testDir, "hooks");
			mkdirSync(hooksDir, { recursive: true });
			// Create hooks directory but no hooks.toml

			const result = loadHooksFromCapability(testDir);
			expect(result.found).toBe(false);
			expect(result.config).toEqual({});
		});

		test("loads valid hooks.toml", () => {
			createHooksConfig(`
description = "Test hooks"

[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = "echo test"
`);

			const result = loadHooksFromCapability(testDir);
			expect(result.found).toBe(true);
			expect(result.validation.valid).toBe(true);
			expect(result.config.description).toBe("Test hooks");
			expect(result.config.PreToolUse).toHaveLength(1);
			expect(result.config.PreToolUse?.[0]?.matcher).toBe("Bash");
		});

		test("loads config with multiple events", () => {
			createHooksConfig(`
[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = "echo pre"

[[PostToolUse]]
matcher = "Write"
[[PostToolUse.hooks]]
type = "command"
command = "echo post"

[[Stop]]
[[Stop.hooks]]
type = "prompt"
prompt = "Check completion"
`);

			const result = loadHooksFromCapability(testDir);
			expect(result.validation.valid).toBe(true);
			expect(result.config.PreToolUse).toHaveLength(1);
			expect(result.config.PostToolUse).toHaveLength(1);
			expect(result.config.Stop).toHaveLength(1);
		});

		test("transforms Claude variables to OmniDev format", () => {
			createHooksConfig(`
[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = '"$\{CLAUDE_PLUGIN_ROOT}/hooks/validate.sh"'
`);

			const result = loadHooksFromCapability(testDir, { transformVariables: true });
			expect(result.validation.valid).toBe(true);
			const hook = result.config.PreToolUse?.[0]?.hooks[0];
			expect(hook?.type).toBe("command");
			if (hook?.type === "command") {
				expect(hook.command).toContain("OMNIDEV_CAPABILITY_ROOT");
				expect(hook.command).not.toContain("CLAUDE_PLUGIN_ROOT");
			}
		});

		test("skips variable transformation when disabled", () => {
			createHooksConfig(`
[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = '"$\{CLAUDE_PLUGIN_ROOT}/hooks/validate.sh"'
`);

			const result = loadHooksFromCapability(testDir, { transformVariables: false });
			// Validation will warn about CLAUDE_ variables
			expect(result.found).toBe(true);
		});

		test("returns error for invalid TOML syntax", () => {
			createHooksConfig(`
This is not valid TOML
[[PreToolUse
`);

			const result = loadHooksFromCapability(testDir);
			expect(result.found).toBe(true);
			expect(result.validation.valid).toBe(false);
			expect(result.validation.errors.some((e) => e.code === "HOOKS_INVALID_TOML")).toBe(true);
			expect(result.loadError).toBeDefined();
		});

		test("returns error for invalid hook configuration", () => {
			createHooksConfig(`
[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "unknown"
command = "echo test"
`);

			const result = loadHooksFromCapability(testDir);
			expect(result.found).toBe(true);
			expect(result.validation.valid).toBe(false);
			expect(result.validation.errors.some((e) => e.code === "HOOKS_INVALID_TYPE")).toBe(true);
		});

		test("returns configPath when hooks are found", () => {
			createHooksConfig(`
[[PreToolUse]]
[[PreToolUse.hooks]]
type = "command"
command = "echo test"
`);

			const result = loadHooksFromCapability(testDir);
			expect(result.configPath).toBe(join(testDir, "hooks", "hooks.toml"));
		});

		test("skips validation when disabled", () => {
			createHooksConfig(`
[[UnknownEvent]]
[[UnknownEvent.hooks]]
type = "command"
command = "echo test"
`);

			const result = loadHooksFromCapability(testDir, { validate: false });
			expect(result.found).toBe(true);
			// Validation is skipped, so result should appear valid
			expect(result.validation.valid).toBe(true);
		});
	});

	describe("loadCapabilityHooks", () => {
		test("returns null when no hooks found", () => {
			const result = loadCapabilityHooks("test-cap", testDir);
			expect(result).toBeNull();
		});

		test("returns CapabilityHooks when hooks are found", () => {
			createHooksConfig(`
[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = "echo test"
`);

			const result = loadCapabilityHooks("test-cap", testDir);
			expect(result).not.toBeNull();
			expect(result?.capabilityName).toBe("test-cap");
			expect(result?.capabilityPath).toBe(testDir);
			expect(result?.config.PreToolUse).toHaveLength(1);
			expect(result?.validation.valid).toBe(true);
		});
	});

	describe("hasHooks", () => {
		test("returns false when no hooks directory", () => {
			expect(hasHooks(testDir)).toBe(false);
		});

		test("returns false when hooks directory exists but no hooks.toml", () => {
			mkdirSync(join(testDir, "hooks"), { recursive: true });
			expect(hasHooks(testDir)).toBe(false);
		});

		test("returns true when hooks.toml exists", () => {
			createHooksConfig("description = 'test'");
			expect(hasHooks(testDir)).toBe(true);
		});
	});

	describe("getHooksDirectory", () => {
		test("returns correct path", () => {
			const dir = getHooksDirectory("/path/to/capability");
			expect(dir).toBe("/path/to/capability/hooks");
		});
	});

	describe("getHooksConfigPath", () => {
		test("returns correct path", () => {
			const path = getHooksConfigPath("/path/to/capability");
			expect(path).toBe("/path/to/capability/hooks/hooks.toml");
		});
	});
});
