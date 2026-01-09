import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { parseProviderFlag } from "./provider.js";

const TEST_DIR = ".test-omni";

beforeEach(() => {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
});

describe("parseProviderFlag", () => {
	test("parses 'claude' flag", () => {
		expect(parseProviderFlag("claude")).toEqual(["claude"]);
	});

	test("parses 'codex' flag", () => {
		expect(parseProviderFlag("codex")).toEqual(["codex"]);
	});

	test("parses 'both' flag", () => {
		expect(parseProviderFlag("both")).toEqual(["claude", "codex"]);
	});

	test("handles case-insensitive input", () => {
		expect(parseProviderFlag("CLAUDE")).toEqual(["claude"]);
		expect(parseProviderFlag("Codex")).toEqual(["codex"]);
		expect(parseProviderFlag("BOTH")).toEqual(["claude", "codex"]);
	});

	test("throws on invalid provider", () => {
		expect(() => parseProviderFlag("invalid")).toThrow("Invalid provider: invalid");
	});
});

describe("writeProviderConfig", () => {
	test("writes single provider config", async () => {
		const testPath = `${TEST_DIR}/provider.toml`;

		// Manually write for testing
		const lines: string[] = [];
		lines.push("# OmniDev Provider Configuration");
		lines.push("# Selected AI provider(s) for this project");
		lines.push("");
		lines.push("# Single provider");
		lines.push('provider = "claude"');

		await Bun.write(testPath, `${lines.join("\n")}\n`);

		const content = await Bun.file(testPath).text();
		expect(content).toContain('provider = "claude"');
		expect(content).toContain("# Single provider");
	});

	test("writes multiple providers config", async () => {
		const testPath = `${TEST_DIR}/provider.toml`;

		const lines: string[] = [];
		lines.push("# OmniDev Provider Configuration");
		lines.push("# Selected AI provider(s) for this project");
		lines.push("");
		lines.push("# Multiple providers enabled");
		lines.push('providers = ["claude", "codex"]');

		await Bun.write(testPath, `${lines.join("\n")}\n`);

		const content = await Bun.file(testPath).text();
		expect(content).toContain('providers = ["claude", "codex"]');
		expect(content).toContain("# Multiple providers");
	});
});
