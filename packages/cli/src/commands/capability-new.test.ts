import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { runCapabilityNew } from "./capability.js";

// Mock @inquirer/prompts
mock.module("@inquirer/prompts", () => ({
	input: mock(async ({ default: defaultValue }: { default: string }) => defaultValue),
}));

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
			`[profiles.default]
capabilities = []
`,
			"utf-8",
		);
	}

	test("creates capability directory with all templates at default path", async () => {
		await setupOmniDevProject();

		// Using --path flag to skip prompt
		await runCapabilityNew({ path: "capabilities/my-cap" }, "my-cap");

		// Check all files are created at capabilities/my-cap (not .omni/capabilities)
		expect(existsSync("capabilities/my-cap")).toBe(true);
		expect(existsSync("capabilities/my-cap/capability.toml")).toBe(true);
		expect(existsSync("capabilities/my-cap/skills/getting-started/SKILL.md")).toBe(true);
		expect(existsSync("capabilities/my-cap/rules/coding-standards.md")).toBe(true);
		expect(existsSync("capabilities/my-cap/hooks/hooks.toml")).toBe(true);
		expect(existsSync("capabilities/my-cap/hooks/example-hook.sh")).toBe(true);
	});

	test("creates capability at custom path with --path flag", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "custom/path/my-cap" }, "my-cap");

		expect(existsSync("custom/path/my-cap")).toBe(true);
		expect(existsSync("custom/path/my-cap/capability.toml")).toBe(true);
	});

	test("generates correct capability.toml content", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/my-cap" }, "my-cap");

		const toml = readFileSync("capabilities/my-cap/capability.toml", "utf-8");
		expect(toml).toContain('id = "my-cap"');
		expect(toml).toContain('name = "My Cap"');
		expect(toml).toContain('version = "0.1.0"');
	});

	test("generates skill template with correct frontmatter", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/test-cap" }, "test-cap");

		const skill = readFileSync("capabilities/test-cap/skills/getting-started/SKILL.md", "utf-8");
		expect(skill).toContain("name: getting-started");
		expect(skill).toContain("## What I do");
		expect(skill).toContain("## When to use me");
	});

	test("generates rule template with ### header", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/test-cap" }, "test-cap");

		const rule = readFileSync("capabilities/test-cap/rules/coding-standards.md", "utf-8");
		expect(rule).toContain("### Coding Standards");
		expect(rule).toContain("TODO: Add specific guidelines");
	});

	test("generates hooks template with OMNIDEV variables", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/test-cap" }, "test-cap");

		const hooks = readFileSync("capabilities/test-cap/hooks/hooks.toml", "utf-8");
		expect(hooks).toContain("PreToolUse");
		expect(hooks).toContain("OMNIDEV_CAPABILITY_ROOT");
	});

	test("generates hook script with bash shebang", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/test-cap" }, "test-cap");

		const script = readFileSync("capabilities/test-cap/hooks/example-hook.sh", "utf-8");
		expect(script).toContain("#!/bin/bash");
		expect(script).toContain("INPUT=$(cat)");
	});

	test("uses default path from prompt when no --path flag", async () => {
		await setupOmniDevProject();

		// Without --path flag, should use the prompt which returns default value
		await runCapabilityNew({}, "prompted-cap");

		// The mock returns the default value which is "capabilities/<id>"
		expect(existsSync("capabilities/prompted-cap")).toBe(true);
		expect(existsSync("capabilities/prompted-cap/capability.toml")).toBe(true);
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

	test("prevents duplicate capability creation at same path", async () => {
		await setupOmniDevProject();
		mkdirSync("capabilities/existing", { recursive: true });

		const originalError = console.error;
		console.error = () => {};

		try {
			await runCapabilityNew({ path: "capabilities/existing" }, "existing");
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
			await runCapabilityNew({ path: "capabilities/test-cap" }, "test-cap");
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;
		console.log = originalLog;

		expect(exitCode).toBe(1);
	});

	test("converts kebab-case id to Title Case name", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/my-awesome-capability" }, "my-awesome-capability");

		const toml = readFileSync("capabilities/my-awesome-capability/capability.toml", "utf-8");
		expect(toml).toContain('name = "My Awesome Capability"');
	});

	test("accepts single-word capability ID", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/tasks" }, "tasks");

		expect(existsSync("capabilities/tasks")).toBe(true);
		const toml = readFileSync("capabilities/tasks/capability.toml", "utf-8");
		expect(toml).toContain('id = "tasks"');
		expect(toml).toContain('name = "Tasks"');
	});

	test("creates programmatic capability with --programmatic flag", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/my-cli", programmatic: true }, "my-cli");

		// Check standard files exist
		expect(existsSync("capabilities/my-cli")).toBe(true);
		expect(existsSync("capabilities/my-cli/capability.toml")).toBe(true);

		// Check programmatic files exist
		expect(existsSync("capabilities/my-cli/package.json")).toBe(true);
		expect(existsSync("capabilities/my-cli/index.ts")).toBe(true);
		expect(existsSync("capabilities/my-cli/.gitignore")).toBe(true);
	});

	test("generates correct package.json for programmatic capability", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/api-tool", programmatic: true }, "api-tool");

		const pkg = JSON.parse(readFileSync("capabilities/api-tool/package.json", "utf-8"));
		expect(pkg.name).toBe("@capability/api-tool");
		expect(pkg.version).toBe("0.1.0");
		expect(pkg.type).toBe("module");
		expect(pkg.main).toBe("dist/index.js");
		expect(pkg.scripts.build).toContain("@omnidev-ai/capability");
		expect(pkg.dependencies["@omnidev-ai/capability"]).toBe("latest");
	});

	test("generates correct index.ts for programmatic capability", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/my-tool", programmatic: true }, "my-tool");

		const indexTs = readFileSync("capabilities/my-tool/index.ts", "utf-8");
		expect(indexTs).toContain("CapabilityExport");
		expect(indexTs).toContain("command");
		expect(indexTs).toContain("@omnidev-ai/capability");
		expect(indexTs).toContain("cliCommands");
		expect(indexTs).toContain('"my-tool"');
		expect(indexTs).toContain("My Tool");
	});

	test("generates .gitignore for programmatic capability", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/test-cap", programmatic: true }, "test-cap");

		const gitignore = readFileSync("capabilities/test-cap/.gitignore", "utf-8");
		expect(gitignore).toContain("dist/");
		expect(gitignore).toContain("node_modules/");
	});

	test("does not create programmatic files without --programmatic flag", async () => {
		await setupOmniDevProject();

		await runCapabilityNew({ path: "capabilities/plain-cap" }, "plain-cap");

		// Standard files should exist
		expect(existsSync("capabilities/plain-cap/capability.toml")).toBe(true);

		// Programmatic files should NOT exist
		expect(existsSync("capabilities/plain-cap/package.json")).toBe(false);
		expect(existsSync("capabilities/plain-cap/index.ts")).toBe(false);
		expect(existsSync("capabilities/plain-cap/.gitignore")).toBe(false);
	});

	test("programmatic capability handles kebab-case in variable names", async () => {
		await setupOmniDevProject();

		await runCapabilityNew(
			{ path: "capabilities/my-awesome-tool", programmatic: true },
			"my-awesome-tool",
		);

		const indexTs = readFileSync("capabilities/my-awesome-tool/index.ts", "utf-8");
		// Variable names should not contain hyphens
		expect(indexTs).toContain("myawesometoolCommand");
		expect(indexTs).toContain("runMyawesometool");
		// But the CLI command key should preserve kebab-case
		expect(indexTs).toContain('"my-awesome-tool"');
	});
});
