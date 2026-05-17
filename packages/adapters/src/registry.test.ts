import { describe, expect, test } from "bun:test";
import { getProviderGitignoreEntries } from "./registry";

describe("getProviderGitignoreEntries", () => {
	test("includes Claude Code root MCP config with Claude outputs", () => {
		expect(getProviderGitignoreEntries(["claude-code"])).toEqual([
			"CLAUDE.md",
			".claude/",
			".mcp.json",
		]);
	});

	test("does not include root MCP config for Codex", () => {
		expect(getProviderGitignoreEntries(["codex"])).toEqual(["AGENTS.md", ".codex/"]);
	});

	test("includes shared instruction files for providers that write them", () => {
		expect(getProviderGitignoreEntries(["cursor"])).toEqual(["CLAUDE.md", ".cursor/"]);
		expect(getProviderGitignoreEntries(["opencode"])).toEqual(["AGENTS.md", ".opencode/"]);
	});

	test("deduplicates shared output entries across providers", () => {
		expect(getProviderGitignoreEntries(["codex", "opencode"])).toEqual([
			"AGENTS.md",
			".codex/",
			".opencode/",
		]);
	});
});
