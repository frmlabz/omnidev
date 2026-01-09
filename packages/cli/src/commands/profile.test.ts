import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runProfileList, runProfileSet } from "./profile";

describe("profile commands", () => {
	let testDir: string;
	let originalCwd: string;
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;
	let consoleOutput: string[];
	let consoleErrors: string[];

	beforeEach(() => {
		// Create a unique test directory
		testDir = join(import.meta.dir, "..", "..", "..", "test-temp", `profile-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalCwd = process.cwd();
		process.chdir(testDir);

		// Mock process.exit
		exitCode = undefined;
		originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCode = code ?? 0;
			throw new Error(`process.exit(${code})`);
		}) as typeof process.exit;

		// Mock console
		consoleOutput = [];
		consoleErrors = [];
		const originalLog = console.log;
		const originalError = console.error;
		console.log = (...args: unknown[]) => {
			consoleOutput.push(args.join(" "));
		};
		console.error = (...args: unknown[]) => {
			consoleErrors.push(args.join(" "));
		};

		// Restore after test (in afterEach)
		return () => {
			console.log = originalLog;
			console.error = originalError;
		};
	});

	afterEach(() => {
		process.exit = originalExit;
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("runProfileList", () => {
		test("should show error when config file does not exist", async () => {
			try {
				await runProfileList();
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleOutput.join("\n")).toContain("No config file found");
			expect(consoleOutput.join("\n")).toContain("Run: omnidev init");
		});

		test("should show message when no profiles defined", async () => {
			// Create minimal config without profiles
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"
default_profile = "default"

[capabilities]
enable = ["tasks"]
`,
			);

			await runProfileList();

			expect(exitCode).toBeUndefined();
			expect(consoleOutput.join("\n")).toContain("No profiles defined");
			expect(consoleOutput.join("\n")).toContain("Using default capabilities");
		});

		test("should list all profiles from config", async () => {
			// Create config with profiles
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"
default_profile = "default"

[capabilities]
enable = ["tasks"]

[profiles.default]

[profiles.planning]
enable = ["tasks", "planner"]

[profiles.coding]
disable = ["planner"]
`,
			);

			await runProfileList();

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("Available Profiles:");
			expect(output).toContain("default");
			expect(output).toContain("planning");
			expect(output).toContain("coding");
		});

		test("should show active profile with marker", async () => {
			// Create config with profiles
			mkdirSync(".omni", { recursive: true });
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"
default_profile = "default"

[capabilities]
enable = ["tasks"]

[profiles.default]

[profiles.planning]
enable = ["planner"]
`,
			);
			await Bun.write(".omni/active-profile", "planning");

			await runProfileList();

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("● planning (active)");
			expect(output).toContain("○ default");
		});

		test("should show profile capabilities", async () => {
			// Create config with profiles
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"
default_profile = "default"

[capabilities]
enable = ["tasks"]

[profiles.default]

[profiles.planning]
enable = ["planner"]
disable = ["tasks"]
`,
			);

			await runProfileList();

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("Enable: planner");
			expect(output).toContain("Disable: tasks");
		});

		test("should use default_profile when no active profile", async () => {
			// Create config with default_profile
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"
default_profile = "planning"

[capabilities]
enable = ["tasks"]

[profiles.planning]
enable = ["planner"]
`,
			);

			await runProfileList();

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("● planning (active)");
		});

		test("should handle invalid config gracefully", async () => {
			// Create invalid config
			mkdirSync(".omni", { recursive: true });
			await Bun.write(".omni/config.toml", "invalid toml [[[");

			try {
				await runProfileList();
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Error loading profiles");
		});
	});

	describe("runProfileSet", () => {
		test("should show error when config file does not exist", async () => {
			try {
				await runProfileSet("planning");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleOutput.join("\n")).toContain("No config file found");
			expect(consoleOutput.join("\n")).toContain("Run: omnidev init");
		});

		test("should show error when profile does not exist", async () => {
			// Create config without the requested profile
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"

[profiles.default]
`,
			);

			try {
				await runProfileSet("nonexistent");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			const output = consoleOutput.join("\n");
			expect(output).toContain('Profile "nonexistent" not found');
			expect(output).toContain("Available profiles:");
			expect(output).toContain("- default");
		});

		test("should set active profile", async () => {
			// Create config with profiles
			mkdirSync(".omni", { recursive: true });
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"

[profiles.default]

[profiles.planning]
enable = ["planner"]
`,
			);

			await runProfileSet("planning");

			expect(exitCode).toBeUndefined();
			expect(consoleOutput.join("\n")).toContain("Active profile set to: planning");

			// Verify file was written
			const activeProfile = await Bun.file(".omni/active-profile").text();
			expect(activeProfile.trim()).toBe("planning");
		});

		test("should trigger agents sync after setting profile", async () => {
			// Create config with profiles
			mkdirSync(".omni", { recursive: true });
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"

[profiles.planning]
`,
			);

			await runProfileSet("planning");

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("Syncing agent configuration");
			// Since agents sync doesn't exist yet, we expect the note
			expect(output).toContain("agents sync not yet implemented");
		});

		test("should show list of available profiles when profile not found", async () => {
			// Create config with multiple profiles
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"

[profiles.default]
[profiles.planning]
[profiles.coding]
`,
			);

			try {
				await runProfileSet("nonexistent");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			const output = consoleOutput.join("\n");
			expect(output).toContain("Available profiles:");
			expect(output).toContain("- default");
			expect(output).toContain("- planning");
			expect(output).toContain("- coding");
		});

		test("should handle empty profiles config", async () => {
			// Create config without any profiles
			mkdirSync(".omni", { recursive: true });
			await Bun.write(
				".omni/config.toml",
				`project = "test-project"

[capabilities]
enable = ["tasks"]
`,
			);

			try {
				await runProfileSet("default");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			const output = consoleOutput.join("\n");
			expect(output).toContain('Profile "default" not found');
			expect(output).toContain("(none defined)");
		});

		test("should handle invalid config gracefully", async () => {
			// Create invalid config
			mkdirSync(".omni", { recursive: true });
			await Bun.write(".omni/config.toml", "invalid toml [[[");

			try {
				await runProfileSet("planning");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Error setting profile");
		});
	});
});
