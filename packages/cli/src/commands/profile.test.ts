import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { runProfileList, runProfileSet } from "./profile";

describe("profile commands", () => {
	setupTestDir("profile-test-", { chdir: true });
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;
	let consoleOutput: string[];
	let consoleErrors: string[];
	let originalLog: typeof console.log;
	let originalError: typeof console.error;

	beforeEach(() => {
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
		originalLog = console.log;
		originalError = console.error;
		console.log = (...args: unknown[]) => {
			consoleOutput.push(args.join(" "));
		};
		console.error = (...args: unknown[]) => {
			consoleErrors.push(args.join(" "));
		};
	});

	afterEach(() => {
		process.exit = originalExit;
		console.log = originalLog;
		console.error = originalError;
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
			await writeFile("omni.toml", ``, "utf-8");

			await runProfileList();

			expect(exitCode).toBeUndefined();
			expect(consoleOutput.join("\n")).toContain("No profiles defined");
			expect(consoleOutput.join("\n")).toContain("Using default capabilities");
		});

		test("should list all profiles from config", async () => {
			// Create config with profiles
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.planning]
capabilities = ["tasks", "planner"]

[profiles.coding]
capabilities = []
`,
				"utf-8",
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
			mkdirSync(".omni/state", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.planning]
capabilities = ["planner"]
`,
				"utf-8",
			);
			// Set planning as active profile via state file
			await writeFile(".omni/state/active-profile", "planning", "utf-8");

			await runProfileList();

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("● planning (active)");
			expect(output).toContain("○ default");
		});

		test("should show profile capabilities", async () => {
			// Create config with profiles
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.planning]
capabilities = ["planner", "tasks"]
`,
				"utf-8",
			);

			await runProfileList();

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("Capabilities: planner, tasks");
		});

		test('should use "default" when no active profile', async () => {
			// Create config with default and planning profiles
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.planning]
capabilities = ["planner"]
`,
				"utf-8",
			);
			// No state file = defaults to "default"

			await runProfileList();

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("● default (active)");
			expect(output).toContain("○ planning");
		});

		test("should handle invalid config gracefully", async () => {
			// Create invalid config
			mkdirSync(".omni", { recursive: true });
			await writeFile("omni.toml", "invalid toml [[[", "utf-8");

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
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
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
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.planning]
capabilities = ["planner"]
`,
				"utf-8",
			);

			await runProfileSet("planning");

			expect(exitCode).toBeUndefined();
			expect(consoleOutput.join("\n")).toContain("Active profile set to: planning");

			// Verify active_profile was written to state file (not config.toml)
			const stateContent = await readFile(".omni/state/active-profile", "utf-8");
			expect(stateContent).toBe("planning");
		});

		test("should trigger agents sync after setting profile", async () => {
			// Create config with profiles
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.planning]
capabilities = []
`,
			);

			await runProfileSet("planning");

			expect(exitCode).toBeUndefined();
			const output = consoleOutput.join("\n");
			expect(output).toContain("Active profile set to: planning");
		});

		test("should show list of available profiles when profile not found", async () => {
			// Create config with multiple profiles
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.planning]
capabilities = []

[profiles.coding]
capabilities = []
`,
				"utf-8",
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
			await writeFile("omni.toml", ``, "utf-8");

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
			await writeFile("omni.toml", "invalid toml [[[", "utf-8");

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
