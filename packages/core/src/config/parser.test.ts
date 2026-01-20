import { describe, expect, test } from "bun:test";
import { parseCapabilityConfig, parseOmniConfig } from "./parser";

describe("parseOmniConfig", () => {
	test("parses valid TOML with all fields", () => {
		const toml = `
project = "my-project"
default_profile = "dev"

[capabilities]
enable = ["tasks", "git"]
disable = ["docker"]

[profiles.dev]
enable = ["debug"]
disable = []

[profiles.prod]
enable = []
disable = ["debug"]
		`;

		const config = parseOmniConfig(toml);

		expect(config.project).toBe("my-project");
		expect(config.default_profile).toBe("dev");
		expect(config.capabilities?.enable).toEqual(["tasks", "git"]);
		expect(config.capabilities?.disable).toEqual(["docker"]);
		expect(config.profiles?.dev?.enable).toEqual(["debug"]);
		expect(config.profiles?.prod?.disable).toEqual(["debug"]);
	});

	test("parses minimal TOML", () => {
		const toml = `
project = "minimal"
		`;

		const config = parseOmniConfig(toml);

		expect(config.project).toBe("minimal");
		expect(config.capabilities).toBeUndefined();
		expect(config.profiles).toBeUndefined();
	});

	test("parses empty TOML", () => {
		const config = parseOmniConfig("");

		expect(config).toEqual({});
	});

	test("parses TOML with arrays", () => {
		const toml = `
[capabilities]
enable = ["cap1", "cap2", "cap3"]
		`;

		const config = parseOmniConfig(toml);

		expect(config.capabilities?.enable).toEqual(["cap1", "cap2", "cap3"]);
	});

	test("parses TOML with nested tables", () => {
		const toml = `
[profiles.dev]
enable = ["debug"]

[profiles.prod]
disable = ["debug"]
		`;

		const config = parseOmniConfig(toml);

		expect(config.profiles?.dev?.enable).toEqual(["debug"]);
		expect(config.profiles?.prod?.disable).toEqual(["debug"]);
	});

	test("throws error for invalid TOML syntax", () => {
		const toml = `
project = "test
[invalid
		`;

		expect(() => parseOmniConfig(toml)).toThrow(/Invalid TOML in config:/);
	});

	test("throws error for duplicate keys", () => {
		const toml = `
project = "test"
project = "duplicate"
		`;

		expect(() => parseOmniConfig(toml)).toThrow(/Invalid TOML in config:/);
	});

	test("handles boolean values", () => {
		const toml = `
[capabilities]
debug = true
production = false
		`;

		const config = parseOmniConfig(toml);

		expect((config.capabilities as Record<string, unknown>)?.debug).toBe(true);
		expect((config.capabilities as Record<string, unknown>)?.production).toBe(false);
	});

	test("handles numeric values", () => {
		const toml = `
timeout = 30
max_retries = 5
		`;

		const config = parseOmniConfig(toml);

		expect((config as Record<string, unknown>).timeout).toBe(30);
		expect((config as Record<string, unknown>).max_retries).toBe(5);
	});
});

describe("parseCapabilityConfig", () => {
	test("parses valid capability.toml with all required fields", () => {
		const toml = `
[capability]
id = "tasks"
name = "Task Management"
version = "1.0.0"
description = "Manage tasks and workflows"
		`;

		const config = parseCapabilityConfig(toml);

		expect(config.capability.id).toBe("tasks");
		expect(config.capability.name).toBe("Task Management");
		expect(config.capability.version).toBe("1.0.0");
		expect(config.capability.description).toBe("Manage tasks and workflows");
	});

	test("parses capability with exports", () => {
		const toml = `
[capability]
id = "tasks"
name = "Task Management"
version = "1.0.0"
description = "Manage tasks"

[exports]
module = "index.ts"
		`;

		const config = parseCapabilityConfig(toml);

		expect(config.exports?.module).toBe("index.ts");
	});

	test("throws error when capability.id is missing", () => {
		const toml = `
[capability]
name = "Test"
version = "1.0.0"
		`;

		expect(() => parseCapabilityConfig(toml)).toThrow(
			/capability.id is required in capability.toml/,
		);
	});

	test("throws error when capability.name is missing", () => {
		const toml = `
[capability]
id = "test"
version = "1.0.0"
		`;

		expect(() => parseCapabilityConfig(toml)).toThrow(
			/capability.name is required in capability.toml/,
		);
	});

	test("throws error when capability.version is missing", () => {
		const toml = `
[capability]
id = "test"
name = "Test"
		`;

		expect(() => parseCapabilityConfig(toml)).toThrow(
			/capability.version is required in capability.toml/,
		);
	});

	test("throws error when capability table is missing", () => {
		const toml = `
project = "test"
		`;

		expect(() => parseCapabilityConfig(toml)).toThrow(
			/capability.id is required in capability.toml/,
		);
	});

	test("throws error for invalid TOML syntax", () => {
		const toml = `
[capability
id = "test"
		`;

		expect(() => parseCapabilityConfig(toml)).toThrow(/Invalid capability.toml:/);
	});
});
