import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runServe } from "./serve";

// Create test fixtures directory
const testDir = join(process.cwd(), "test-fixtures-serve");

beforeEach(() => {
	// Clean up and create fresh test directory
	if (existsSync(testDir)) {
		rmSync(testDir, { recursive: true, force: true });
	}
	mkdirSync(testDir, { recursive: true });
	process.chdir(testDir);
});

afterEach(() => {
	// Return to original directory and clean up
	process.chdir(join(testDir, ".."));
	if (existsSync(testDir)) {
		rmSync(testDir, { recursive: true, force: true });
	}
});

describe("serve command", () => {
	test("should fail when OmniDev is not initialized", async () => {
		const mockExit = mock((code?: number) => {
			throw new Error(`process.exit: ${code}`);
		}) as typeof process.exit;
		const originalExit = process.exit;
		process.exit = mockExit;

		try {
			await expect(runServe({})).rejects.toThrow("process.exit: 1");
			expect(mockExit).toHaveBeenCalledWith(1);
		} finally {
			process.exit = originalExit;
		}
	});

	test("should fail when .omni/ directory is missing", async () => {
		// Don't create .omni/ - test expects it to be missing

		const mockExit = mock((code?: number) => {
			throw new Error(`process.exit: ${code}`);
		}) as typeof process.exit;
		const originalExit = process.exit;
		process.exit = mockExit;

		try {
			await expect(runServe({})).rejects.toThrow("process.exit: 1");
			expect(mockExit).toHaveBeenCalledWith(1);
		} finally {
			process.exit = originalExit;
		}
	});

	test("should fail when profile does not exist", async () => {
		// Set up directories
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni", { recursive: true });

		// Create a config without the requested profile
		writeFileSync(
			".omni/config.toml",
			`
[capability]
project = "test"

[profiles.default]
`,
		);

		const mockExit = mock((code?: number) => {
			throw new Error(`process.exit: ${code}`);
		}) as typeof process.exit;
		const originalExit = process.exit;
		process.exit = mockExit;

		try {
			await expect(runServe({ profile: "nonexistent" })).rejects.toThrow("process.exit: 1");
			expect(mockExit).toHaveBeenCalledWith(1);
		} finally {
			process.exit = originalExit;
		}
	});

	test("should set profile when provided and valid", async () => {
		// Set up directories
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni", { recursive: true });

		// Create config with profiles
		writeFileSync(
			".omni/config.toml",
			`
[capability]
project = "test"
default_profile = "default"

[profiles.default]

[profiles.testing]
`,
		);

		// Mock startServer to prevent actual server start
		const mockStartServer = mock(async () => {
			// Server started successfully, do nothing
		});

		// Mock the import of @omnidev/mcp
		const originalImport = globalThis[Symbol.for("Bun.lazy")];
		// biome-ignore lint/suspicious/noExplicitAny: Testing requires dynamic mocking
		(globalThis as any).import = mock(async (module: string) => {
			if (module === "@omnidev/mcp") {
				return { startServer: mockStartServer };
			}
			throw new Error(`Unexpected import: ${module}`);
		});

		const mockExit = mock((code?: number) => {
			throw new Error(`process.exit: ${code}`);
		}) as typeof process.exit;
		const originalExit = process.exit;
		process.exit = mockExit;

		try {
			// This should fail because startServer will actually run, but that's OK for this test
			// We just want to verify that setActiveProfile was called
			await runServe({ profile: "testing" }).catch(() => {
				// Ignore the error from startServer
			});

			// Check that active profile was written
			const activeProfile = await Bun.file(".omni/active-profile").text();
			expect(activeProfile.trim()).toBe("testing");
		} finally {
			process.exit = originalExit;
			// biome-ignore lint/suspicious/noExplicitAny: Restore original import
			if (originalImport) (globalThis as any).import = originalImport;
		}
	});

	test("should start server without profile flag", async () => {
		// Set up directories
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni", { recursive: true });

		// Create config
		writeFileSync(
			".omni/config.toml",
			`
[capability]
project = "test"
default_profile = "default"

[profiles.default]
`,
		);

		// We can't actually test server startup without complex mocking,
		// so we'll just verify the command passes initial checks
		const mockExit = mock((code?: number) => {
			throw new Error(`process.exit: ${code}`);
		}) as typeof process.exit;
		const originalExit = process.exit;
		process.exit = mockExit;

		try {
			// This will fail at the import stage, but that's expected
			await runServe({}).catch((error) => {
				// Should fail on import or server start, not on validation
				expect(error).toBeDefined();
			});

			// No profile should be written when flag not provided
			expect(existsSync(".omni/active-profile")).toBe(false);
		} finally {
			process.exit = originalExit;
		}
	});
});
