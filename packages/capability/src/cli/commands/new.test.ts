import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNew, isValidCapabilityId } from "./new.js";

describe("capability new command", () => {
	let testDir: string;
	let originalCwd: string;
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;

	beforeEach(() => {
		// Create a temp directory for tests
		testDir = join(tmpdir(), `capability-new-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Change to test directory
		originalCwd = process.cwd();
		process.chdir(testDir);

		// Mock process.exit
		exitCode = undefined;
		originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as typeof process.exit;
	});

	afterEach(() => {
		// Restore original state
		process.chdir(originalCwd);
		process.exit = originalExit;

		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("isValidCapabilityId", () => {
		test("accepts valid kebab-case IDs", () => {
			expect(isValidCapabilityId("my-cap")).toBe(true);
			expect(isValidCapabilityId("tasks")).toBe(true);
			expect(isValidCapabilityId("api-client")).toBe(true);
			expect(isValidCapabilityId("my-awesome-capability")).toBe(true);
			expect(isValidCapabilityId("a")).toBe(true);
			expect(isValidCapabilityId("a1")).toBe(true);
			expect(isValidCapabilityId("a-1")).toBe(true);
		});

		test("rejects invalid IDs", () => {
			expect(isValidCapabilityId("Invalid-ID")).toBe(false); // uppercase
			expect(isValidCapabilityId("123-cap")).toBe(false); // starts with number
			expect(isValidCapabilityId("-cap")).toBe(false); // starts with dash
			expect(isValidCapabilityId("cap-")).toBe(false); // ends with dash
			expect(isValidCapabilityId("cap--name")).toBe(false); // double dash
			expect(isValidCapabilityId("cap_name")).toBe(false); // underscore
			expect(isValidCapabilityId("")).toBe(false); // empty
		});
	});

	test("creates capability directory with all templates", async () => {
		await runNew("my-cap", { path: "test-cap" });

		// Check all files are created
		expect(existsSync("test-cap")).toBe(true);
		expect(existsSync("test-cap/capability.toml")).toBe(true);
		expect(existsSync("test-cap/skills/getting-started/SKILL.md")).toBe(true);
		expect(existsSync("test-cap/rules/coding-standards.md")).toBe(true);
		expect(existsSync("test-cap/hooks/hooks.toml")).toBe(true);
		expect(existsSync("test-cap/hooks/example-hook.sh")).toBe(true);
	});

	test("creates capability at custom path", async () => {
		await runNew("my-cap", { path: "custom/path/my-cap" });

		expect(existsSync("custom/path/my-cap")).toBe(true);
		expect(existsSync("custom/path/my-cap/capability.toml")).toBe(true);
	});

	test("uses default path when not specified", async () => {
		await runNew("default-cap", {});

		expect(existsSync("capabilities/default-cap")).toBe(true);
		expect(existsSync("capabilities/default-cap/capability.toml")).toBe(true);
	});

	test("generates correct capability.toml content", async () => {
		await runNew("my-cap", { path: "test-cap" });

		const toml = readFileSync("test-cap/capability.toml", "utf-8");
		expect(toml).toContain('id = "my-cap"');
		expect(toml).toContain('name = "My Cap"');
		expect(toml).toContain('version = "0.1.0"');
	});

	test("generates skill template with correct frontmatter", async () => {
		await runNew("test-cap", { path: "test-cap" });

		const skill = readFileSync("test-cap/skills/getting-started/SKILL.md", "utf-8");
		expect(skill).toContain("name: getting-started");
		expect(skill).toContain("## What I do");
		expect(skill).toContain("## When to use me");
	});

	test("generates rule template with ### header", async () => {
		await runNew("test-cap", { path: "test-cap" });

		const rule = readFileSync("test-cap/rules/coding-standards.md", "utf-8");
		expect(rule).toContain("### Coding Standards");
		expect(rule).toContain("TODO: Add specific guidelines");
	});

	test("generates hooks template with OMNIDEV variables", async () => {
		await runNew("test-cap", { path: "test-cap" });

		const hooks = readFileSync("test-cap/hooks/hooks.toml", "utf-8");
		expect(hooks).toContain("PreToolUse");
		expect(hooks).toContain("OMNIDEV_CAPABILITY_ROOT");
	});

	test("generates hook script with bash shebang", async () => {
		await runNew("test-cap", { path: "test-cap" });

		const script = readFileSync("test-cap/hooks/example-hook.sh", "utf-8");
		expect(script).toContain("#!/bin/bash");
		expect(script).toContain("INPUT=$(cat)");
	});

	test("validates capability ID format", async () => {
		const originalError = console.error;
		const originalLog = console.log;
		console.error = () => {};
		console.log = () => {};

		try {
			await runNew("Invalid-ID", {});
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;
		console.log = originalLog;

		expect(exitCode).toBe(1);
	});

	test("prevents duplicate capability creation at same path", async () => {
		mkdirSync("existing-cap", { recursive: true });

		const originalError = console.error;
		console.error = () => {};

		try {
			await runNew("test", { path: "existing-cap" });
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;

		expect(exitCode).toBe(1);
	});

	test("converts kebab-case id to Title Case name", async () => {
		await runNew("my-awesome-capability", { path: "my-awesome-cap" });

		const toml = readFileSync("my-awesome-cap/capability.toml", "utf-8");
		expect(toml).toContain('name = "My Awesome Capability"');
	});

	describe("programmatic capability", () => {
		test("creates programmatic files with --programmatic flag", async () => {
			await runNew("my-cli", { path: "my-cli", programmatic: true });

			// Check standard files exist
			expect(existsSync("my-cli")).toBe(true);
			expect(existsSync("my-cli/capability.toml")).toBe(true);

			// Check programmatic files exist
			expect(existsSync("my-cli/package.json")).toBe(true);
			expect(existsSync("my-cli/index.ts")).toBe(true);
			expect(existsSync("my-cli/.gitignore")).toBe(true);
		});

		test("generates correct package.json", async () => {
			await runNew("api-tool", { path: "api-tool", programmatic: true });

			const pkg = JSON.parse(readFileSync("api-tool/package.json", "utf-8"));
			expect(pkg.name).toBe("@capability/api-tool");
			expect(pkg.version).toBe("0.1.0");
			expect(pkg.type).toBe("module");
			expect(pkg.main).toBe("dist/index.js");
			expect(pkg.scripts.build).toContain("@omnidev-ai/capability");
			expect(pkg.dependencies["@omnidev-ai/capability"]).toBe("latest");
		});

		test("generates correct index.ts", async () => {
			await runNew("my-tool", { path: "my-tool", programmatic: true });

			const indexTs = readFileSync("my-tool/index.ts", "utf-8");
			expect(indexTs).toContain("CapabilityExport");
			expect(indexTs).toContain("command");
			expect(indexTs).toContain("@omnidev-ai/capability");
			expect(indexTs).toContain("cliCommands");
			expect(indexTs).toContain('"my-tool"');
			expect(indexTs).toContain("My Tool");
		});

		test("generates .gitignore", async () => {
			await runNew("test-cap", { path: "test-cap", programmatic: true });

			const gitignore = readFileSync("test-cap/.gitignore", "utf-8");
			expect(gitignore).toContain("dist/");
			expect(gitignore).toContain("node_modules/");
		});

		test("does not create programmatic files without flag", async () => {
			await runNew("plain-cap", { path: "plain-cap" });

			// Standard files should exist
			expect(existsSync("plain-cap/capability.toml")).toBe(true);

			// Programmatic files should NOT exist
			expect(existsSync("plain-cap/package.json")).toBe(false);
			expect(existsSync("plain-cap/index.ts")).toBe(false);
			expect(existsSync("plain-cap/.gitignore")).toBe(false);
		});

		test("handles kebab-case in variable names", async () => {
			await runNew("my-awesome-tool", { path: "my-awesome-tool", programmatic: true });

			const indexTs = readFileSync("my-awesome-tool/index.ts", "utf-8");
			// Variable names should not contain hyphens
			expect(indexTs).toContain("myawesometoolCommand");
			expect(indexTs).toContain("runMyawesometool");
			// But the CLI command key should preserve kebab-case
			expect(indexTs).toContain('"my-awesome-tool"');
		});
	});
});
