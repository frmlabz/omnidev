import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runDoctor } from "./doctor";

describe("doctor command", () => {
	let testDir: string;
	let originalCwd: string;
	let originalExit: typeof process.exit;
	let exitCalled: boolean;
	let exitCode: number;

	// Helper to create complete .omni structure
	function createCompleteStructure() {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			".omni/config.toml",
			`project = "test"
default_profile = "default"
`,
		);
		writeFileSync(
			".omni/provider.toml",
			`claude = true
codex = false
`,
		);
		writeFileSync(
			".omni/capabilities.toml",
			`enabled = []
disabled = []
`,
		);
		writeFileSync(
			".omni/profiles.toml",
			`[default]
enable = []
disable = []
`,
		);
		writeFileSync(
			".omni/.gitignore",
			`# OmniDev Core
.env
generated/
state/
sandbox/
*.log
`,
		);
	}

	beforeEach(() => {
		// Create a unique test directory
		testDir = join(
			process.cwd(),
			".test-tmp",
			`doctor-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		);
		mkdirSync(testDir, { recursive: true });

		// Change to test directory
		originalCwd = process.cwd();
		process.chdir(testDir);

		// Mock process.exit
		exitCalled = false;
		exitCode = 0;
		originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCalled = true;
			exitCode = code ?? 0;
		}) as typeof process.exit;
	});

	afterEach(() => {
		// Restore process.exit
		process.exit = originalExit;

		// Restore working directory
		process.chdir(originalCwd);

		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("should pass all checks when setup is complete", async () => {
		// Setup complete OmniDev structure
		createCompleteStructure();

		await runDoctor();

		expect(exitCalled).toBe(false);
	});

	test("should fail when .omni/ directory is missing", async () => {
		// Don't create .omni - the test expects it to be missing

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should fail when config.toml is missing", async () => {
		mkdirSync(".omni", { recursive: true });

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should fail when config.toml is invalid", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(".omni/config.toml", "invalid toml [[[");

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should check Bun version is 1.0+", async () => {
		// We can't change Bun.version in tests, but we can verify the check runs
		// The version check should pass in our dev environment
		createCompleteStructure();

		await runDoctor();

		// Should not exit with error (Bun version should be >= 1.0)
		expect(exitCalled).toBe(false);
	});

	test("should suggest fixes for missing directories", async () => {
		// No setup - all checks should fail

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should handle partial setup", async () => {
		// Only create omni/ directory
		mkdirSync(".omni", { recursive: true });

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should fail when config has invalid syntax", async () => {
		mkdirSync(".omni", { recursive: true });

		// Create a config with invalid TOML syntax
		writeFileSync(".omni/config.toml", "invalid = [[[]]");

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should pass with minimal valid config", async () => {
		createCompleteStructure();

		await runDoctor();

		expect(exitCalled).toBe(false);
	});

	test("should validate provider.toml exists", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			".omni/config.toml",
			`project = "test"
default_profile = "default"
`,
		);
		// Missing provider.toml

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should validate capabilities.toml exists", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			".omni/config.toml",
			`project = "test"
default_profile = "default"
`,
		);
		writeFileSync(
			".omni/provider.toml",
			`claude = true
codex = false
`,
		);
		// Missing capabilities.toml

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should validate profiles.toml exists", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			".omni/config.toml",
			`project = "test"
default_profile = "default"
`,
		);
		writeFileSync(
			".omni/provider.toml",
			`claude = true
codex = false
`,
		);
		writeFileSync(
			".omni/capabilities.toml",
			`enabled = []
disabled = []
`,
		);
		// Missing profiles.toml

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should validate internal .gitignore exists", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			".omni/config.toml",
			`project = "test"
default_profile = "default"
`,
		);
		writeFileSync(
			".omni/provider.toml",
			`claude = true
codex = false
`,
		);
		writeFileSync(
			".omni/capabilities.toml",
			`enabled = []
disabled = []
`,
		);
		writeFileSync(
			".omni/profiles.toml",
			`[default]
enable = []
disable = []
`,
		);
		// Missing .omni/.gitignore

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should pass when capabilities directory is missing (no custom capabilities)", async () => {
		createCompleteStructure();
		// Don't create .omni/capabilities directory

		await runDoctor();

		// Should still pass - capabilities directory is optional
		expect(exitCalled).toBe(false);
	});
});
