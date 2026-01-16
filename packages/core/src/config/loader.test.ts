import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { loadConfig } from "./loader";

const TEST_DIR = "/tmp/omnidev-test-loader";
const CONFIG_PATH = "omni.toml";
const LOCAL_CONFIG = "omni.local.toml";

// Save and restore the current working directory
let originalCwd: string;

beforeEach(() => {
	// Save original cwd
	originalCwd = process.cwd();

	// Clean up test directory
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
	mkdirSync(TEST_DIR, { recursive: true });
	process.chdir(TEST_DIR);
});

afterEach(() => {
	// Restore original cwd
	process.chdir(originalCwd);

	// Clean up test directory
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
});

describe("loadConfig", () => {
	test("returns empty config when no files exist", async () => {
		const config = await loadConfig();
		expect(config).toEqual({
			env: {},
			profiles: {},
		});
	});

	test("loads config when only main config exists", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			CONFIG_PATH,
			`
project = "my-project"
active_profile = "dev"

[profiles.dev]
capabilities = ["tasks", "git"]
`,
		);

		const config = await loadConfig();
		expect(config.project).toBe("my-project");
		expect(config.active_profile).toBe("dev");
		expect(config.profiles?.dev?.capabilities).toEqual(["tasks", "git"]);
	});

	test("loads local config when only local config exists", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			LOCAL_CONFIG,
			`
project = "local-project"

[profiles.default]
capabilities = ["local-only"]
`,
		);

		const config = await loadConfig();
		expect(config.project).toBe("local-project");
		expect(config.profiles?.default?.capabilities).toEqual(["local-only"]);
	});

	test("merges main and local configs with local taking precedence", async () => {
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
project = "main-project"
active_profile = "production"

[profiles.default]
capabilities = ["tasks"]

[env]
API_URL = "https://main-api.com"
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
project = "local-override"

[profiles.default]
capabilities = ["git"]

[env]
API_URL = "http://localhost:3000"
DEBUG = "true"
`,
		);

		const config = await loadConfig();

		// Local overrides should take precedence
		expect(config.project).toBe("local-override");

		// Profile capabilities from local should override main
		expect(config.profiles?.default?.capabilities).toEqual(["git"]);

		// Env should be merged with local taking precedence
		expect(config.env?.API_URL).toBe("http://localhost:3000");
		expect(config.env?.DEBUG).toBe("true");
	});

	test("merges profiles with local taking precedence", async () => {
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[profiles.dev]
capabilities = ["tasks"]

[profiles.prod]
capabilities = ["git"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[profiles.dev]
capabilities = ["local-tasks"]
`,
		);

		const config = await loadConfig();
		expect(config.profiles?.dev?.capabilities).toEqual(["local-tasks"]);
		expect(config.profiles?.prod?.capabilities).toEqual(["git"]);
	});

	test("handles empty profiles sections gracefully", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			CONFIG_PATH,
			`
project = "test"
`,
		);

		const config = await loadConfig();
		expect(config.profiles).toEqual({});
	});

	test("handles invalid TOML in main config", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(CONFIG_PATH, "invalid toml [[[");

		await expect(loadConfig()).rejects.toThrow("Invalid TOML in config");
	});

	test("handles invalid TOML in local config", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(LOCAL_CONFIG, "invalid toml [[[");

		await expect(loadConfig()).rejects.toThrow("Invalid TOML in config");
	});

	test("merges env objects correctly", async () => {
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[env]
VAR1 = "team1"
VAR2 = "team2"
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[env]
VAR2 = "local2"
VAR3 = "local3"
`,
		);

		const config = await loadConfig();
		expect(config.env?.VAR1).toBe("team1");
		expect(config.env?.VAR2).toBe("local2");
		expect(config.env?.VAR3).toBe("local3");
	});

	test("reads active_profile from config.toml for backwards compatibility", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
active_profile = "production"
`,
		);

		const config = await loadConfig();
		// active_profile is still readable from config.toml for backwards compatibility
		// but new writes go to state file via setActiveProfile()
		expect(config.active_profile).toBe("production");
	});

	test("loads sandbox_enabled = true from config", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			CONFIG_PATH,
			`
sandbox_enabled = true
`,
		);

		const config = await loadConfig();
		expect(config.sandbox_enabled).toBe(true);
	});

	test("loads sandbox_enabled = false from config", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			CONFIG_PATH,
			`
sandbox_enabled = false
`,
		);

		const config = await loadConfig();
		expect(config.sandbox_enabled).toBe(false);
	});

	test("sandbox_enabled is undefined when not specified", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			CONFIG_PATH,
			`
project = "test"
`,
		);

		const config = await loadConfig();
		expect(config.sandbox_enabled).toBeUndefined();
	});

	test("local config can override sandbox_enabled", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
sandbox_enabled = true
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
sandbox_enabled = false
`,
		);

		const config = await loadConfig();
		expect(config.sandbox_enabled).toBe(false);
	});
});
