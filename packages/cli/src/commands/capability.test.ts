import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runCapabilityDisable, runCapabilityEnable, runCapabilityList } from "./capability";

describe("capability list command", () => {
	let testDir: string;
	let originalCwd: string;
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = join(import.meta.dir, `test-capability-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
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
		process.exit = originalExit;
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("shows message when no capabilities found", async () => {
		// Create minimal setup
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni/capabilities", { recursive: true });
		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = []
`,
		);

		const consoleLogs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			consoleLogs.push(args.join(" "));
		};

		await runCapabilityList();

		console.log = originalLog;

		expect(consoleLogs.some((log) => log.includes("No capabilities found"))).toBe(true);
		expect(
			consoleLogs.some((log) => log.includes("create directories in omni/capabilities/")),
		).toBe(true);
	});

	test("lists all discovered capabilities with enabled status", async () => {
		// Create test structure
		mkdirSync(".omni/capabilities/tasks", { recursive: true });
		await Bun.write(
			".omni/capabilities/tasks/capability.toml",
			`[capability]
id = "tasks"
name = "Task Management"
version = "1.0.0"
description = "Task tracking"
`,
		);

		mkdirSync(".omni/capabilities/notes", { recursive: true });
		await Bun.write(
			".omni/capabilities/notes/capability.toml",
			`[capability]
id = "notes"
name = "Note Taking"
version = "0.5.0"
description = "Note management"
`,
		);

		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = ["tasks"]
`,
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
		await Bun.write(
			".omni/capabilities/test-cap/capability.toml",
			`[capability]
id = "test-cap"
name = "Test Capability"
version = "2.3.4"
description = "Test"
`,
		);

		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = ["test-cap"]
`,
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
		await Bun.write(
			".omni/capabilities/valid/capability.toml",
			`[capability]
id = "valid"
name = "Valid"
version = "1.0.0"
description = "Valid capability"
`,
		);

		mkdirSync(".omni/capabilities/invalid", { recursive: true });
		await Bun.write(".omni/capabilities/invalid/capability.toml", "invalid toml [[[");

		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = ["valid", "invalid"]
`,
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
		await Bun.write(
			".omni/capabilities/tasks/capability.toml",
			`[capability]
id = "tasks"
name = "Tasks"
version = "1.0.0"
description = "Task tracking"
`,
		);

		await Bun.write(
			".omni/config.toml",
			`project = "test"
active_profile = "coding"

[profiles.coding]
capabilities = ["tasks"]
`,
		);

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
		await Bun.write(".omni/config.toml", "invalid toml [[[");
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
			await Bun.write(
				`.omni/capabilities/${cap}/capability.toml`,
				`[capability]
id = "${cap}"
name = "${cap.toUpperCase()}"
version = "1.0.0"
description = "${cap} capability"
`,
			);
		}

		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = ["alpha", "beta", "gamma"]
`,
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
	let testDir: string;
	let originalCwd: string;
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = join(import.meta.dir, `test-capability-enable-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
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
		process.exit = originalExit;
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("enables a capability", async () => {
		mkdirSync(".omni/capabilities/tasks", { recursive: true });
		await Bun.write(
			".omni/capabilities/tasks/capability.toml",
			`[capability]
id = "tasks"
name = "Tasks"
version = "1.0.0"
description = "Task tracking"
`,
		);

		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = []
`,
		);

		await runCapabilityEnable({}, "tasks");

		const content = await Bun.file(".omni/config.toml").text();
		expect(content).toContain('capabilities = ["tasks"]');
	});

	test("adds capability to profile when enabling", async () => {
		mkdirSync(".omni/capabilities/tasks", { recursive: true });
		await Bun.write(
			".omni/capabilities/tasks/capability.toml",
			`[capability]
id = "tasks"
name = "Tasks"
version = "1.0.0"
description = "Task tracking"
`,
		);

		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = []
`,
		);

		await runCapabilityEnable({}, "tasks");

		const content = await Bun.file(".omni/config.toml").text();
		expect(content).toContain('capabilities = ["tasks"]');
	});

	test("exits with error if capability doesn't exist", async () => {
		mkdirSync(".omni", { recursive: true });
		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = []
`,
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
	let testDir: string;
	let originalCwd: string;
	let originalExit: typeof process.exit;
	let _exitCode: number | undefined;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = join(import.meta.dir, `test-capability-disable-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);

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
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("disables a capability", async () => {
		mkdirSync(".omni", { recursive: true });
		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = ["tasks"]
`,
		);

		await runCapabilityDisable({}, "tasks");

		const content = await Bun.file(".omni/config.toml").text();
		expect(content).toContain("capabilities = []");
	});

	test("removes capability from profile", async () => {
		mkdirSync(".omni", { recursive: true });
		await Bun.write(
			".omni/config.toml",
			`project = "test"

[profiles.default]
capabilities = ["tasks", "notes"]
`,
		);

		await runCapabilityDisable({}, "tasks");

		const content = await Bun.file(".omni/config.toml").text();
		expect(content).toContain('capabilities = ["notes"]');
	});
});
