import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { LoadedCapability, ManagedOutput } from "../types";
import {
	buildManifestFromCapabilities,
	cleanupStaleManagedOutputs,
	cleanupStaleResources,
	loadManifest,
	saveManifest,
	type ResourceManifest,
} from "./manifest";

async function writeTextFile(path: string, content: string): Promise<void> {
	const dir = dirname(path);
	if (dir !== ".") {
		mkdirSync(dir, { recursive: true });
	}
	await writeFile(path, content, "utf-8");
}

async function readTextFile(path: string): Promise<string> {
	return await readFile(path, "utf-8");
}

function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function createManagedOutput(
	path: string,
	writerId: string,
	content: string,
	options?: Partial<ManagedOutput>,
): ManagedOutput {
	return {
		path,
		writerId,
		hash: hashContent(content),
		cleanupStrategy: options?.cleanupStrategy ?? "delete-file",
		...(options?.pruneRoot ? { pruneRoot: options.pruneRoot } : {}),
		...(options?.jsonKey ? { jsonKey: options.jsonKey } : {}),
	};
}

describe("manifest", () => {
	setupTestDir("manifest-test-", { chdir: true, createOmniDir: true });

	describe("loadManifest", () => {
		test("returns empty v2 manifest when file does not exist", async () => {
			const manifest = await loadManifest();

			expect(manifest.version).toBe(2);
			expect(manifest.capabilities).toEqual({});
			expect(manifest.providers).toEqual({});
			expect(manifest.syncedAt).toBeDefined();
		});

		test("migrates v1 manifests without provider outputs", async () => {
			await writeTextFile(
				".omni/state/manifest.json",
				JSON.stringify({
					version: 1,
					syncedAt: "2025-01-01T00:00:00.000Z",
					capabilities: {
						"test-cap": {
							skills: ["skill1"],
							rules: ["rule1"],
							commands: ["cmd1"],
							subagents: ["agent1"],
							mcps: [],
						},
					},
				}),
			);

			const manifest = await loadManifest();

			expect(manifest).toEqual({
				version: 2,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"test-cap": {
						skills: ["skill1"],
						rules: ["rule1"],
						commands: ["cmd1"],
						subagents: ["agent1"],
						mcps: [],
					},
				},
				providers: {},
			});
		});
	});

	describe("saveManifest", () => {
		test("creates state directory and writes manifest", async () => {
			const manifest: ResourceManifest = {
				version: 2,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"my-cap": {
						skills: ["s1", "s2"],
						rules: ["r1"],
						commands: [],
						subagents: [],
						mcps: [],
					},
				},
				providers: {
					"claude-code": {
						outputs: {
							".claude/skills/s1/SKILL.md": createManagedOutput(
								".claude/skills/s1/SKILL.md",
								"skills",
								"skill content",
								{
									cleanupStrategy: "delete-file-and-prune-empty-parents",
									pruneRoot: ".claude/skills",
								},
							),
						},
					},
				},
			};

			await saveManifest(manifest);

			const content = await readTextFile(".omni/state/manifest.json");
			expect(JSON.parse(content)).toEqual(manifest);
		});
	});

	describe("buildManifestFromCapabilities", () => {
		test("builds manifest from loaded capabilities and provider outputs", () => {
			const capabilities: LoadedCapability[] = [
				{
					id: "cap1",
					path: "/path/to/cap1",
					config: { capability: { id: "cap1", name: "Cap 1", version: "1.0.0", description: "" } },
					skills: [
						{ name: "skill-a", description: "A", instructions: "", capabilityId: "cap1" },
						{ name: "skill-b", description: "B", instructions: "", capabilityId: "cap1" },
					],
					rules: [{ name: "rule-a", content: "", capabilityId: "cap1" }],
					docs: [],
					subagents: [
						{
							name: "agent-a",
							description: "",
							systemPrompt: "",
							capabilityId: "cap1",
						},
					],
					commands: [
						{
							name: "cmd-a",
							description: "",
							prompt: "",
							capabilityId: "cap1",
						},
					],
					exports: {},
				},
			];

			const providerOutputs = new Map([
				[
					"claude-code",
					[
						createManagedOutput(".claude/skills/skill-a/SKILL.md", "skills", "skill-a", {
							cleanupStrategy: "delete-file-and-prune-empty-parents",
							pruneRoot: ".claude/skills",
						}),
					],
				],
			]);

			const manifest = buildManifestFromCapabilities(capabilities, providerOutputs);

			expect(manifest.version).toBe(2);
			expect(manifest.capabilities.cap1).toEqual({
				skills: ["skill-a", "skill-b"],
				rules: ["rule-a"],
				commands: ["cmd-a"],
				subagents: ["agent-a"],
				mcps: [],
			});
			expect(manifest.providers["claude-code"]?.outputs[".claude/skills/skill-a/SKILL.md"]).toEqual(
				providerOutputs.get("claude-code")?.[0],
			);
		});

		test("tracks singular and named MCP resources", () => {
			const capabilities: LoadedCapability[] = [
				{
					id: "research",
					path: "/fake/research",
					config: {
						capability: {
							id: "research",
							name: "Research",
							version: "1.0.0",
							description: "",
						},
						mcp: { command: "legacy-research" },
						mcps: {
							tavily: { transport: "http", url: "https://mcp.tavily.com/mcp/" },
							context7: { command: "npx", args: ["-y", "@upstash/context7-mcp"] },
						},
					},
					skills: [],
					rules: [],
					docs: [],
					subagents: [],
					commands: [],
					exports: {},
				},
			];

			const manifest = buildManifestFromCapabilities(capabilities);

			expect(manifest.capabilities.research?.mcps).toEqual(["research", "tavily", "context7"]);
		});
	});

	describe("saveManifest and loadManifest round-trip", () => {
		test("save then load returns same manifest", async () => {
			const manifest: ResourceManifest = {
				version: 2,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					cap1: { skills: ["s1"], rules: ["r1"], commands: ["c1"], subagents: ["a1"], mcps: [] },
				},
				providers: {
					codex: {
						outputs: {
							"AGENTS.md": createManagedOutput("AGENTS.md", "instructions-md", "agents"),
						},
					},
				},
			};

			await saveManifest(manifest);
			const loaded = await loadManifest();

			expect(loaded).toEqual(manifest);
		});
	});

	describe("cleanupStaleResources", () => {
		test("is a no-op for provider-managed files", async () => {
			const result = await cleanupStaleResources(
				{
					version: 2,
					syncedAt: "2025-01-01T00:00:00.000Z",
					capabilities: {},
					providers: {},
				},
				new Set(["cap"]),
			);

			expect(result).toEqual({
				deletedSkills: [],
				deletedRules: [],
				deletedCommands: [],
				deletedSubagents: [],
				deletedMcps: [],
			});
		});
	});

	describe("cleanupStaleManagedOutputs", () => {
		test("deletes stale managed skill files and prunes empty parent directories", async () => {
			const skillContent = "---\nname: old-skill\ndescription: old\n---\n\nold";
			await writeTextFile(".claude/skills/old-skill/SKILL.md", skillContent);

			const previousManifest: ResourceManifest = {
				version: 2,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {},
				providers: {
					"claude-code": {
						outputs: {
							".claude/skills/old-skill/SKILL.md": createManagedOutput(
								".claude/skills/old-skill/SKILL.md",
								"skills",
								skillContent,
								{
									cleanupStrategy: "delete-file-and-prune-empty-parents",
									pruneRoot: ".claude/skills",
								},
							),
						},
					},
				},
			};

			const result = await cleanupStaleManagedOutputs(previousManifest, new Map());

			expect(result.deletedPaths).toEqual([".claude/skills/old-skill/SKILL.md"]);
			expect(existsSync(".claude/skills/old-skill")).toBe(false);
		});

		test("preserves modified tracked files and reports skipped cleanup", async () => {
			await writeTextFile(".cursor/rules/omnidev-old-rule.mdc", "user modified");

			const previousManifest: ResourceManifest = {
				version: 2,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {},
				providers: {
					cursor: {
						outputs: {
							".cursor/rules/omnidev-old-rule.mdc": createManagedOutput(
								".cursor/rules/omnidev-old-rule.mdc",
								"cursor-rules",
								"original content",
							),
						},
					},
				},
			};

			const result = await cleanupStaleManagedOutputs(previousManifest, new Map());

			expect(result.deletedPaths).toEqual([]);
			expect(result.skippedPaths).toEqual([
				{
					path: ".cursor/rules/omnidev-old-rule.mdc",
					reason: "managed file changed at .cursor/rules/omnidev-old-rule.mdc",
				},
			]);
			expect(await readTextFile(".cursor/rules/omnidev-old-rule.mdc")).toBe("user modified");
		});

		test("removes only managed hooks from settings.json", async () => {
			const hooks = {
				PreToolUse: [
					{
						matcher: "Write",
						hooks: [{ type: "command", command: "echo write" }],
					},
				],
			};

			await writeTextFile(
				".claude/settings.json",
				JSON.stringify({ someOtherSetting: true, hooks }, null, 2),
			);

			const previousManifest: ResourceManifest = {
				version: 2,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {},
				providers: {
					"claude-code": {
						outputs: {
							".claude/settings.json": createManagedOutput(
								".claude/settings.json",
								"hooks",
								JSON.stringify(hooks),
								{
									cleanupStrategy: "remove-json-key",
									jsonKey: "hooks",
								},
							),
						},
					},
				},
			};

			const result = await cleanupStaleManagedOutputs(previousManifest, new Map());

			expect(result.deletedPaths).toEqual([".claude/settings.json"]);
			expect(JSON.parse(await readTextFile(".claude/settings.json"))).toEqual({
				someOtherSetting: true,
			});
		});

		test("does not delete paths still claimed by another provider", async () => {
			const content = "# Shared";
			await writeTextFile("CLAUDE.md", content);

			const previousManifest: ResourceManifest = {
				version: 2,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {},
				providers: {
					"claude-code": {
						outputs: {
							"CLAUDE.md": createManagedOutput("CLAUDE.md", "instructions-md", content),
						},
					},
				},
			};

			const nextProviders = new Map([
				["cursor", [createManagedOutput("CLAUDE.md", "instructions-md", content)]],
			]);

			const result = await cleanupStaleManagedOutputs(previousManifest, nextProviders);

			expect(result.deletedPaths).toEqual([]);
			expect(existsSync("CLAUDE.md")).toBe(true);
		});
	});
});
