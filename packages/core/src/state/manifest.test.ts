import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { LoadedCapability } from "../types";
import {
	buildManifestFromCapabilities,
	cleanupStaleResources,
	loadManifest,
	saveManifest,
	type ResourceManifest,
} from "./manifest";

describe("manifest", () => {
	let originalCwd: string;
	let tempDir: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		tempDir = mkdtempSync(join(tmpdir(), "manifest-test-"));
		mkdirSync(join(tempDir, ".omni"), { recursive: true });
		process.chdir(tempDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("loadManifest", () => {
		test("returns empty manifest when file does not exist", async () => {
			const manifest = await loadManifest();

			expect(manifest.version).toBe(1);
			expect(manifest.capabilities).toEqual({});
			expect(manifest.syncedAt).toBeDefined();
		});

		test("loads existing manifest from disk", async () => {
			const existingManifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"test-cap": {
						skills: ["skill1"],
						rules: ["rule1"],
						commands: ["cmd1"],
						subagents: ["agent1"],
					},
				},
			};

			await Bun.write(".omni/state/manifest.json", JSON.stringify(existingManifest));

			const manifest = await loadManifest();

			expect(manifest).toEqual(existingManifest);
		});
	});

	describe("saveManifest", () => {
		test("creates state directory and writes manifest", async () => {
			const manifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"my-cap": {
						skills: ["s1", "s2"],
						rules: ["r1"],
						commands: [],
						subagents: [],
					},
				},
			};

			await saveManifest(manifest);

			const content = await Bun.file(".omni/state/manifest.json").text();
			expect(JSON.parse(content)).toEqual(manifest);
		});
	});

	describe("buildManifestFromCapabilities", () => {
		test("builds manifest from loaded capabilities", () => {
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
				{
					id: "cap2",
					path: "/path/to/cap2",
					config: { capability: { id: "cap2", name: "Cap 2", version: "1.0.0", description: "" } },
					skills: [],
					rules: [],
					docs: [],
					subagents: [],
					commands: [],
					exports: {},
				},
			];

			const manifest = buildManifestFromCapabilities(capabilities);

			expect(manifest.version).toBe(1);
			expect(manifest.capabilities.cap1).toEqual({
				skills: ["skill-a", "skill-b"],
				rules: ["rule-a"],
				commands: ["cmd-a"],
				subagents: ["agent-a"],
			});
			expect(manifest.capabilities.cap2).toEqual({
				skills: [],
				rules: [],
				commands: [],
				subagents: [],
			});
		});

		test("handles empty capabilities array", () => {
			const manifest = buildManifestFromCapabilities([]);

			expect(manifest.version).toBe(1);
			expect(manifest.capabilities).toEqual({});
			expect(manifest.syncedAt).toBeDefined();
		});
	});

	describe("saveManifest and loadManifest round-trip", () => {
		test("save then load returns same manifest", async () => {
			const manifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					cap1: { skills: ["s1"], rules: ["r1"], commands: ["c1"], subagents: ["a1"] },
					cap2: { skills: [], rules: [], commands: [], subagents: [] },
				},
			};

			await saveManifest(manifest);
			const loaded = await loadManifest();

			expect(loaded).toEqual(manifest);
		});

		test("overwrites existing manifest", async () => {
			const manifest1: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: { old: { skills: ["old"], rules: [], commands: [], subagents: [] } },
			};
			const manifest2: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-02T00:00:00.000Z",
				capabilities: { new: { skills: ["new"], rules: [], commands: [], subagents: [] } },
			};

			await saveManifest(manifest1);
			await saveManifest(manifest2);
			const loaded = await loadManifest();

			expect(loaded).toEqual(manifest2);
			expect(loaded.capabilities.old).toBeUndefined();
		});
	});

	describe("cleanupStaleResources", () => {
		test("deletes skills and rules from disabled capabilities", async () => {
			// Create skill directory
			await Bun.write(".claude/skills/old-skill/SKILL.md", "old skill content");

			// Create rule file
			await Bun.write(".cursor/rules/omnidev-old-rule.mdc", "old rule content");

			const previousManifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"disabled-cap": {
						skills: ["old-skill"],
						rules: ["old-rule"],
						commands: [],
						subagents: [],
					},
					"enabled-cap": {
						skills: ["keep-skill"],
						rules: ["keep-rule"],
						commands: [],
						subagents: [],
					},
				},
			};

			// Only enabled-cap is in the current set
			const currentCapabilityIds = new Set(["enabled-cap"]);

			const result = await cleanupStaleResources(previousManifest, currentCapabilityIds);

			expect(result.deletedSkills).toEqual(["old-skill"]);
			expect(result.deletedRules).toEqual(["old-rule"]);

			// Verify files are deleted
			const { existsSync } = await import("node:fs");
			expect(existsSync(".claude/skills/old-skill")).toBe(false);
			expect(existsSync(".cursor/rules/omnidev-old-rule.mdc")).toBe(false);
		});

		test("preserves resources from still-enabled capabilities", async () => {
			// Create skill directory for enabled capability
			await Bun.write(".claude/skills/keep-skill/SKILL.md", "keep this");

			const previousManifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"enabled-cap": {
						skills: ["keep-skill"],
						rules: [],
						commands: [],
						subagents: [],
					},
				},
			};

			const currentCapabilityIds = new Set(["enabled-cap"]);

			const result = await cleanupStaleResources(previousManifest, currentCapabilityIds);

			expect(result.deletedSkills).toEqual([]);

			// Verify file still exists
			const { existsSync } = await import("node:fs");
			expect(existsSync(".claude/skills/keep-skill/SKILL.md")).toBe(true);
		});

		test("handles missing files gracefully", async () => {
			const previousManifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"disabled-cap": {
						skills: ["nonexistent-skill"],
						rules: ["nonexistent-rule"],
						commands: [],
						subagents: [],
					},
				},
			};

			const currentCapabilityIds = new Set<string>();

			// Should not throw
			const result = await cleanupStaleResources(previousManifest, currentCapabilityIds);

			expect(result.deletedSkills).toEqual([]);
			expect(result.deletedRules).toEqual([]);
		});

		test("handles empty previous manifest", async () => {
			const previousManifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {},
			};

			const currentCapabilityIds = new Set(["new-cap"]);

			const result = await cleanupStaleResources(previousManifest, currentCapabilityIds);

			expect(result.deletedSkills).toEqual([]);
			expect(result.deletedRules).toEqual([]);
			expect(result.deletedCommands).toEqual([]);
			expect(result.deletedSubagents).toEqual([]);
		});

		test("deletes multiple skills and rules from same capability", async () => {
			// Create multiple skills
			await Bun.write(".claude/skills/skill-1/SKILL.md", "skill 1");
			await Bun.write(".claude/skills/skill-2/SKILL.md", "skill 2");
			await Bun.write(".claude/skills/skill-3/SKILL.md", "skill 3");

			// Create multiple rules
			await Bun.write(".cursor/rules/omnidev-rule-1.mdc", "rule 1");
			await Bun.write(".cursor/rules/omnidev-rule-2.mdc", "rule 2");

			const previousManifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"multi-resource-cap": {
						skills: ["skill-1", "skill-2", "skill-3"],
						rules: ["rule-1", "rule-2"],
						commands: [],
						subagents: [],
					},
				},
			};

			const currentCapabilityIds = new Set<string>();

			const result = await cleanupStaleResources(previousManifest, currentCapabilityIds);

			expect(result.deletedSkills).toEqual(["skill-1", "skill-2", "skill-3"]);
			expect(result.deletedRules).toEqual(["rule-1", "rule-2"]);

			const { existsSync } = await import("node:fs");
			expect(existsSync(".claude/skills/skill-1")).toBe(false);
			expect(existsSync(".claude/skills/skill-2")).toBe(false);
			expect(existsSync(".claude/skills/skill-3")).toBe(false);
			expect(existsSync(".cursor/rules/omnidev-rule-1.mdc")).toBe(false);
			expect(existsSync(".cursor/rules/omnidev-rule-2.mdc")).toBe(false);
		});

		test("deletes resources from multiple disabled capabilities", async () => {
			// Create resources for multiple capabilities
			await Bun.write(".claude/skills/cap1-skill/SKILL.md", "cap1 skill");
			await Bun.write(".claude/skills/cap2-skill/SKILL.md", "cap2 skill");
			await Bun.write(".cursor/rules/omnidev-cap1-rule.mdc", "cap1 rule");
			await Bun.write(".cursor/rules/omnidev-cap2-rule.mdc", "cap2 rule");

			const previousManifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					cap1: {
						skills: ["cap1-skill"],
						rules: ["cap1-rule"],
						commands: [],
						subagents: [],
					},
					cap2: {
						skills: ["cap2-skill"],
						rules: ["cap2-rule"],
						commands: [],
						subagents: [],
					},
					cap3: {
						skills: ["cap3-skill"],
						rules: [],
						commands: [],
						subagents: [],
					},
				},
			};

			// Only cap3 remains enabled
			const currentCapabilityIds = new Set(["cap3"]);

			const result = await cleanupStaleResources(previousManifest, currentCapabilityIds);

			expect(result.deletedSkills).toContain("cap1-skill");
			expect(result.deletedSkills).toContain("cap2-skill");
			expect(result.deletedSkills).not.toContain("cap3-skill");
			expect(result.deletedRules).toContain("cap1-rule");
			expect(result.deletedRules).toContain("cap2-rule");
		});

		test("cleans up when all capabilities are disabled", async () => {
			await Bun.write(".claude/skills/only-skill/SKILL.md", "only");
			await Bun.write(".cursor/rules/omnidev-only-rule.mdc", "only");

			const previousManifest: ResourceManifest = {
				version: 1,
				syncedAt: "2025-01-01T00:00:00.000Z",
				capabilities: {
					"the-only-cap": {
						skills: ["only-skill"],
						rules: ["only-rule"],
						commands: [],
						subagents: [],
					},
				},
			};

			// Empty set - all capabilities disabled
			const currentCapabilityIds = new Set<string>();

			const result = await cleanupStaleResources(previousManifest, currentCapabilityIds);

			expect(result.deletedSkills).toEqual(["only-skill"]);
			expect(result.deletedRules).toEqual(["only-rule"]);
		});
	});
});
