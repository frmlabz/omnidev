import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { runDoctor } from "./doctor";

describe("doctor command", () => {
	setupTestDir("doctor-test-", { chdir: true });
	let originalExit: typeof process.exit;
	let exitCalled: boolean;
	let exitCode: number;

	// Helper to create complete .omni structure
	function createCompleteStructure() {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			"omni.toml",
			`project = "test"
active_profile = "default"

[providers]
enabled = ["claude"]

[profiles.default]
capabilities = []

[profiles.coding]
capabilities = []
`,
		);
		writeFileSync(
			".gitignore",
			`# OmniDev
.omni/
omni.local.toml
`,
		);
	}

	beforeEach(() => {
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
		writeFileSync("omni.toml", "invalid toml [[[");

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
		writeFileSync("omni.toml", "invalid = [[[]]");

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should pass with minimal valid config", async () => {
		createCompleteStructure();

		await runDoctor();

		expect(exitCalled).toBe(false);
	});

	test("should validate root .gitignore has OmniDev entries", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			"omni.toml",
			`project = "test"
active_profile = "default"

[providers]
enabled = ["claude"]

[profiles.default]
capabilities = []
`,
		);
		// Missing root .gitignore

		await runDoctor();

		expect(exitCalled).toBe(true);
		expect(exitCode).toBe(1);
	});

	test("should fail when root .gitignore is missing OmniDev entries", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			"omni.toml",
			`project = "test"
active_profile = "default"

[providers]
enabled = ["claude"]

[profiles.default]
capabilities = []
`,
		);
		// .gitignore exists but missing OmniDev entries
		writeFileSync(".gitignore", "node_modules/\n");

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
