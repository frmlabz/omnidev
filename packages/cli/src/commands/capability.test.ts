import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { runCapabilityDisable, runCapabilityEnable, runCapabilityList } from "./capability";

describe("capability list command", () => {
	setupTestDir("capability-test-", { chdir: true });
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

	test("shows message when no capabilities found", async () => {
		// Create minimal setup
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni/capabilities", { recursive: true });
		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = []
`,
			"utf-8",
		);

		const consoleLogs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			consoleLogs.push(args.join(" "));
		};

		await runCapabilityList();

		console.log = originalLog;

		expect(consoleLogs.some((log) => log.includes("No capabilities found"))).toBe(true);
		expect(consoleLogs.some((log) => log.includes("omnidev add cap"))).toBe(true);
	});

	test("lists all discovered capabilities with enabled status", async () => {
		// Create test structure
		mkdirSync(".omni/capabilities/tasks", { recursive: true });
		await writeFile(
			".omni/capabilities/tasks/capability.toml",
			`[capability]
id = "tasks"
name = "Task Management"
version = "1.0.0"
description = "Task tracking"
`,
			"utf-8",
		);

		mkdirSync(".omni/capabilities/notes", { recursive: true });
		await writeFile(
			".omni/capabilities/notes/capability.toml",
			`[capability]
id = "notes"
name = "Note Taking"
version = "0.5.0"
description = "Note management"
`,
			"utf-8",
		);

		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = ["tasks"]
`,
			"utf-8",
		);

		const consoleLogs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			consoleLogs.push(args.join(" "));
		};

		await runCapabilityList();

		console.log = originalLog;

		const output = consoleLogs.join("\n");

		// Check that both capabilities are shown
		expect(output).toContain("Task Management");
		expect(output).toContain("tasks");
		expect(output).toContain("1.0.0");
		expect(output).toContain("Note Taking");
		expect(output).toContain("notes");
		expect(output).toContain("0.5.0");

		// Check enabled/disabled status
		expect(output).toContain("✓ enabled");
		expect(output).toContain("✗ disabled");
	});

	test("shows capability id and version", async () => {
		mkdirSync(".omni/capabilities/test-cap", { recursive: true });
		await writeFile(
			".omni/capabilities/test-cap/capability.toml",
			`[capability]
id = "test-cap"
name = "Test Capability"
version = "2.3.4"
description = "Test"
`,
			"utf-8",
		);

		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = ["test-cap"]
`,
			"utf-8",
		);

		const consoleLogs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			consoleLogs.push(args.join(" "));
		};

		await runCapabilityList();

		console.log = originalLog;

		const output = consoleLogs.join("\n");

		expect(output).toContain("ID: test-cap");
		expect(output).toContain("Version: 2.3.4");
	});

	test("handles invalid capability gracefully", async () => {
		mkdirSync(".omni/capabilities/valid", { recursive: true });
		await writeFile(
			".omni/capabilities/valid/capability.toml",
			`[capability]
id = "valid"
name = "Valid"
version = "1.0.0"
description = "Valid capability"
`,
			"utf-8",
		);

		mkdirSync(".omni/capabilities/invalid", { recursive: true });
		await writeFile(".omni/capabilities/invalid/capability.toml", "invalid toml [[[", "utf-8");

		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = ["valid", "invalid"]
`,
			"utf-8",
		);

		const consoleLogs: string[] = [];
		const consoleErrors: string[] = [];
		const originalLog = console.log;
		const originalError = console.error;
		console.log = (...args: unknown[]) => {
			consoleLogs.push(args.join(" "));
		};
		console.error = (...args: unknown[]) => {
			consoleErrors.push(args.join(" "));
		};

		await runCapabilityList();

		console.log = originalLog;
		console.error = originalError;

		// Valid capability should be shown
		expect(consoleLogs.join("\n")).toContain("Valid");

		// Invalid capability should show error
		expect(consoleErrors.some((log) => log.includes("Failed to load capability"))).toBe(true);
	});

	test("respects profile when determining enabled status", async () => {
		mkdirSync(".omni/capabilities/tasks", { recursive: true });
		mkdirSync(".omni/state", { recursive: true });
		await writeFile(
			".omni/capabilities/tasks/capability.toml",
			`[capability]
id = "tasks"
name = "Tasks"
version = "1.0.0"
description = "Task tracking"
`,
			"utf-8",
		);

		await writeFile(
			"omni.toml",
			`[profiles.coding]
capabilities = ["tasks"]
`,
			"utf-8",
		);

		// Set coding as the active profile
		await writeFile(".omni/state/active-profile", "coding", "utf-8");

		const consoleLogs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			consoleLogs.push(args.join(" "));
		};

		await runCapabilityList();

		console.log = originalLog;

		const output = consoleLogs.join("\n");

		expect(output).toContain("✓ enabled");
		expect(output).toContain("Tasks");
	});

	test("exits with code 1 on error", async () => {
		// Create an omni directory but with invalid config to trigger error
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni/capabilities", { recursive: true });
		await writeFile("omni.toml", "invalid toml [[[", "utf-8");
		mkdirSync(".omni", { recursive: true });

		const originalError = console.error;
		console.error = () => {}; // Suppress error output

		try {
			await runCapabilityList();
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;

		expect(exitCode).toBe(1);
	});

	test("shows multiple capabilities in order", async () => {
		const capabilities = ["alpha", "beta", "gamma"];

		for (const cap of capabilities) {
			mkdirSync(`.omni/capabilities/${cap}`, { recursive: true });
			await writeFile(
				`.omni/capabilities/${cap}/capability.toml`,
				`[capability]
id = "${cap}"
name = "${cap.toUpperCase()}"
version = "1.0.0"
description = "${cap} capability"
`,
				"utf-8",
			);
		}

		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = ["alpha", "beta", "gamma"]
`,
			"utf-8",
		);

		const consoleLogs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			consoleLogs.push(args.join(" "));
		};

		await runCapabilityList();

		console.log = originalLog;

		const output = consoleLogs.join("\n");

		for (const cap of capabilities) {
			expect(output).toContain(cap.toUpperCase());
			expect(output).toContain(`ID: ${cap}`);
		}
	});
});

describe("capability enable command", () => {
	setupTestDir("capability-enable-test-", { chdir: true });
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

	test("enables a capability", async () => {
		mkdirSync(".omni/capabilities/tasks", { recursive: true });
		await writeFile(
			".omni/capabilities/tasks/capability.toml",
			`[capability]
id = "tasks"
name = "Tasks"
version = "1.0.0"
description = "Task tracking"
`,
			"utf-8",
		);

		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = []
`,
			"utf-8",
		);

		await runCapabilityEnable({}, "tasks");

		const content = await readFile("omni.toml", "utf-8");
		expect(content).toContain('capabilities = ["tasks"]');
	});

	test("adds capability to profile when enabling", async () => {
		mkdirSync(".omni/capabilities/tasks", { recursive: true });
		await writeFile(
			".omni/capabilities/tasks/capability.toml",
			`[capability]
id = "tasks"
name = "Tasks"
version = "1.0.0"
description = "Task tracking"
`,
			"utf-8",
		);

		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = []
`,
			"utf-8",
		);

		await runCapabilityEnable({}, "tasks");

		const content = await readFile("omni.toml", "utf-8");
		expect(content).toContain('capabilities = ["tasks"]');
	});

	test("exits with error if capability doesn't exist", async () => {
		mkdirSync(".omni", { recursive: true });
		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = []
`,
			"utf-8",
		);

		const originalError = console.error;
		const originalLog = console.log;
		console.error = () => {};
		console.log = () => {};

		try {
			await runCapabilityEnable({}, "nonexistent");
		} catch (_error) {
			// Expected to throw from process.exit mock
		}

		console.error = originalError;
		console.log = originalLog;

		expect(exitCode).toBe(1);
	});
});

describe("capability disable command", () => {
	setupTestDir("capability-disable-test-", { chdir: true });
	let originalExit: typeof process.exit;
	let _exitCode: number | undefined;

	beforeEach(() => {
		// Mock process.exit
		_exitCode = undefined;
		originalExit = process.exit;
		process.exit = ((code?: number) => {
			_exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as typeof process.exit;
	});

	afterEach(() => {
		process.exit = originalExit;
	});

	test("disables a capability", async () => {
		mkdirSync(".omni", { recursive: true });
		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = ["tasks"]
`,
			"utf-8",
		);

		await runCapabilityDisable({}, "tasks");

		const content = await readFile("omni.toml", "utf-8");
		expect(content).toContain("capabilities = []");
	});

	test("removes capability from profile", async () => {
		mkdirSync(".omni", { recursive: true });
		await writeFile(
			"omni.toml",
			`[profiles.default]
capabilities = ["tasks", "notes"]
`,
			"utf-8",
		);

		await runCapabilityDisable({}, "tasks");

		const content = await readFile("omni.toml", "utf-8");
		expect(content).toContain('capabilities = ["notes"]');
	});
});
