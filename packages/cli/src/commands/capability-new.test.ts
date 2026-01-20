import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { runCapabilityNew } from "./capability.js";

describe("capability new command", () => {
	setupTestDir("capability-new-test-", { chdir: true });
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;

	beforeEach(() => {
		// Mock process.exit
		exitCode = undefined;
		originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as typeof process.exit;
	});

	afterEach(() => {
		process.exit = originalExit;
	});

	async function setupOmniDevProject() {
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni/capabilities", { recursive: true });
		await writeFile(
			"omni.toml",
			`project = "test"

[profiles.default]
capabilities = []
`,
			"utf-8",
		);
	}

	test("creates capability directory with all templates", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({}, "my-cap");

		// Check all files are created
		expect(existsSync(".omni/capabilities/my-cap")).toBe(true);
		expect(existsSync(".omni/capabilities/my-cap/capability.toml")).toBe(true);
		expect(existsSync(".omni/capabilities/my-cap/skills/getting-started/SKILL.md")).toBe(true);
		expect(existsSync(".omni/capabilities/my-cap/rules/coding-standards.md")).toBe(true);
		expect(existsSync(".omni/capabilities/my-cap/hooks/hooks.toml")).toBe(true);
		expect(existsSync(".omni/capabilities/my-cap/hooks/example-hook.sh")).toBe(true);
	});

	test("generates correct capability.toml content", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({}, "my-cap");

		const toml = readFileSync(".omni/capabilities/my-cap/capability.toml", "utf-8");
		expect(toml).toContain('id = "my-cap"');
		expect(toml).toContain('name = "My Cap"');
		expect(toml).toContain('version = "0.1.0"');
	});

	test("generates skill template with correct frontmatter", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({}, "test-cap");

		const skill = readFileSync(
			".omni/capabilities/test-cap/skills/getting-started/SKILL.md",
			"utf-8",
		);
		expect(skill).toContain("name: getting-started");
		expect(skill).toContain("## What I do");
		expect(skill).toContain("## When to use me");
	});

	test("generates rule template with sections", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({}, "test-cap");

		const rule = readFileSync(".omni/capabilities/test-cap/rules/coding-standards.md", "utf-8");
		expect(rule).toContain("# Coding Standards");
		expect(rule).toContain("## Guidelines");
		expect(rule).toContain("## Examples");
	});

	test("generates hooks template with OMNIDEV variables", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({}, "test-cap");

		const hooks = readFileSync(".omni/capabilities/test-cap/hooks/hooks.toml", "utf-8");
		expect(hooks).toContain("PreToolUse");
		expect(hooks).toContain("OMNIDEV_CAPABILITY_ROOT");
	});

	test("generates hook script with bash shebang", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({}, "test-cap");

		const script = readFileSync(".omni/capabilities/test-cap/hooks/example-hook.sh", "utf-8");
		expect(script).toContain("#!/bin/bash");
		expect(script).toContain("INPUT=$(cat)");
	});

	test("validates capability ID format - rejects uppercase", async () => {
		await setupOmniDevProject();

		const originalError = console.error;
		const originalLog = console.log;
		console.error = () => {};
		console.log = () => {};

		try {
			await runCapabilityNew({}, "Invalid-ID");
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;
		console.log = originalLog;

		expect(exitCode).toBe(1);
	});

	test("validates capability ID format - rejects starting with number", async () => {
		await setupOmniDevProject();

		const originalError = console.error;
		const originalLog = console.log;
		console.error = () => {};
		console.log = () => {};

		try {
			await runCapabilityNew({}, "123-cap");
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;
		console.log = originalLog;

		expect(exitCode).toBe(1);
	});

	test("prevents duplicate capability creation", async () => {
		await setupOmniDevProject();
		mkdirSync(".omni/capabilities/existing", { recursive: true });

		const originalError = console.error;
		console.error = () => {};

		try {
			await runCapabilityNew({}, "existing");
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;

		expect(exitCode).toBe(1);
	});

	test("exits with error if OmniDev is not initialized", async () => {
		const originalError = console.error;
		const originalLog = console.log;
		console.error = () => {};
		console.log = () => {};

		try {
			await runCapabilityNew({}, "test-cap");
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;
		console.log = originalLog;

		expect(exitCode).toBe(1);
	});

	test("converts kebab-case id to Title Case name", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({}, "my-awesome-capability");

		const toml = readFileSync(".omni/capabilities/my-awesome-capability/capability.toml", "utf-8");
		expect(toml).toContain('name = "My Awesome Capability"');
	});

	test("accepts single-word capability ID", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({}, "tasks");

		expect(existsSync(".omni/capabilities/tasks")).toBe(true);
		const toml = readFileSync(".omni/capabilities/tasks/capability.toml", "utf-8");
		expect(toml).toContain('id = "tasks"');
		expect(toml).toContain('name = "Tasks"');
	});
});
