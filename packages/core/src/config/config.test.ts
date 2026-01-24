import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { loadConfig } from "./config";

const CONFIG_PATH = "omni.toml";
const LOCAL_CONFIG = "omni.local.toml";

describe("loadConfig", () => {
	setupTestDir("loader-test-", { chdir: true });
	test("returns empty config when no files exist", async () => {
		const config = await loadConfig();
		expect(config).toEqual({ profiles: {} });
	});

	test("loads config when only main config exists", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			CONFIG_PATH,
			`
[profiles.dev]
capabilities = ["tasks", "git"]
`,
		);

		const config = await loadConfig();
		expect(config.profiles?.dev?.capabilities).toEqual(["tasks", "git"]);
	});

	test("loads local config when only local config exists", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			LOCAL_CONFIG,
			`
[profiles.default]
capabilities = ["local-only"]
`,
		);

		const config = await loadConfig();
		expect(config.profiles?.default?.capabilities).toEqual(["local-only"]);
	});

	test("merges main and local configs with local taking precedence", async () => {
		mkdirSync(".omni", { recursive: true });
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[profiles.default]
capabilities = ["tasks"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[profiles.default]
capabilities = ["git"]
`,
		);

		const config = await loadConfig();

		// Profile capabilities from local should override main
		expect(config.profiles?.default?.capabilities).toEqual(["git"]);
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

	test("merges capability sources from main and local configs", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[capabilities.sources]
tasks = "github:org/tasks"
git = "github:org/git"
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities.sources]
tasks = "file://./local/tasks"
local-cap = "file://./my-local-cap"
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.sources?.tasks).toEqual("file://./local/tasks");
		expect(config.capabilities?.sources?.git).toEqual("github:org/git");
		expect(config.capabilities?.sources?.["local-cap"]).toEqual("file://./my-local-cap");
	});

	test("merges always_disabled from local config", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[profiles.default]
capabilities = ["tasks", "git", "telemetry"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities]
always_disabled = ["telemetry"]
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.always_disabled).toEqual(["telemetry"]);
	});

	test("combines always_disabled from both configs", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[capabilities]
always_disabled = ["noisy-cap"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities]
always_disabled = ["local-disable"]
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.always_disabled).toContain("noisy-cap");
		expect(config.capabilities?.always_disabled).toContain("local-disable");
	});

	test("deduplicates always_disabled when same cap in both configs", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[capabilities]
always_disabled = ["telemetry", "shared-cap"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities]
always_disabled = ["shared-cap", "local-cap"]
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.always_disabled).toEqual(["telemetry", "shared-cap", "local-cap"]);
	});

	test("combines always_enabled from both configs", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[capabilities]
always_enabled = ["logging"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities]
always_enabled = ["debug"]
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.always_enabled).toContain("logging");
		expect(config.capabilities?.always_enabled).toContain("debug");
	});

	test("local config can add capabilities to profile", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[profiles.default]
capabilities = ["tasks"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[profiles.default]
capabilities = ["tasks", "my-private-cap"]
`,
		);

		const config = await loadConfig();
		expect(config.profiles?.default?.capabilities).toEqual(["tasks", "my-private-cap"]);
	});

	test("merges capability groups from both configs", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[capabilities.groups]
expo = ["expo-app-design", "expo-deployment"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities.groups]
local-tools = ["my-tool", "another-tool"]
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.groups?.expo).toEqual(["expo-app-design", "expo-deployment"]);
		expect(config.capabilities?.groups?.["local-tools"]).toEqual(["my-tool", "another-tool"]);
	});

	test("local config can override capability group", async () => {
		mkdirSync(".omni", { recursive: true });

		writeFileSync(
			CONFIG_PATH,
			`
[capabilities.groups]
expo = ["expo-app-design", "expo-deployment"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities.groups]
expo = ["expo-local-override"]
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.groups?.expo).toEqual(["expo-local-override"]);
	});
});
