import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "smol-toml";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { Subagent, SyncBundle } from "@omnidev-ai/core";
import { CodexAgentsWriter } from "./agents";

describe("CodexAgentsWriter", () => {
	const testDir = setupTestDir("codex-agents-writer-", { chdir: true });

	function createBundle(subagents: Subagent[]): SyncBundle {
		return {
			capabilities: [],
			skills: [],
			rules: [],
			docs: [],
			commands: [],
			subagents,
			instructionsContent: "",
		};
	}

	test("has correct id", () => {
		expect(CodexAgentsWriter.id).toBe("codex-agents");
	});

	test("writes required Codex agent fields", async () => {
		const bundle = createBundle([
			{
				name: "reviewer",
				description: "Reviews code for correctness",
				systemPrompt: "Review the diff and report concrete defects.",
				capabilityId: "test-cap",
			},
		]);

		const result = await CodexAgentsWriter.write(bundle, {
			outputPath: ".codex/agents/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".codex/agents/reviewer.toml"]);
		expect(existsSync(`${testDir.path}/.codex/agents/reviewer.toml`)).toBe(true);

		const content = readFileSync(`${testDir.path}/.codex/agents/reviewer.toml`, "utf-8");
		const parsed = parse(content) as Record<string, unknown>;

		expect(parsed.name).toBe("reviewer");
		expect(parsed.description).toBe("Reviews code for correctness");
		expect(parsed.developer_instructions).toBe("Review the diff and report concrete defects.");
	});

	test("serializes optional Codex settings", async () => {
		const bundle = createBundle([
			{
				name: "docs-researcher",
				description: "Verifies APIs against docs",
				systemPrompt: "Use docs and cite the relevant references.",
				capabilityId: "test-cap",
				codex: {
					model: "gpt-5.4-mini",
					modelReasoningEffort: "medium",
					sandboxMode: "read-only",
					nicknameCandidates: ["Atlas", "Delta"],
				},
			},
		]);

		await CodexAgentsWriter.write(bundle, {
			outputPath: ".codex/agents/",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.codex/agents/docs-researcher.toml`, "utf-8");
		const parsed = parse(content) as Record<string, unknown>;

		expect(parsed.model).toBe("gpt-5.4-mini");
		expect(parsed.model_reasoning_effort).toBe("medium");
		expect(parsed.sandbox_mode).toBe("read-only");
		expect(parsed.nickname_candidates).toEqual(["Atlas", "Delta"]);
	});

	test("supports multiline developer instructions", async () => {
		const bundle = createBundle([
			{
				name: "mapper",
				description: "Maps the code path",
				systemPrompt: "Line one.\n\nLine two.",
				capabilityId: "test-cap",
			},
		]);

		await CodexAgentsWriter.write(bundle, {
			outputPath: ".codex/agents/",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.codex/agents/mapper.toml`, "utf-8");
		const parsed = parse(content) as Record<string, unknown>;

		expect(parsed.developer_instructions).toBe("Line one.\n\nLine two.");
	});

	test("returns empty array when no subagents", async () => {
		const result = await CodexAgentsWriter.write(createBundle([]), {
			outputPath: ".codex/agents/",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([]);
		expect(existsSync(`${testDir.path}/.codex/agents`)).toBe(false);
	});
});
