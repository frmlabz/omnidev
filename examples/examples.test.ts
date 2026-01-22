import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { captureConsole, setupTestDir } from "@omnidev-ai/core/test-utils";
import { runInit } from "../packages/cli/src/commands/init.js";
import { runSync } from "../packages/cli/src/commands/sync.js";

/**
 * Integration tests that validate each example configuration file works.
 *
 * These tests pull capabilities from the REAL GitHub repository (github:frmlabz/omnidev).
 * This ensures examples are 1:1 copies of what users will experience.
 *
 * NOTE: Tests will fail if:
 * - No network connection
 * - Fixtures haven't been pushed to GitHub yet
 * - GitHub API rate limits
 *
 * The tests use fixture markers (FIXTURE_MARKER:*) to verify content was synced correctly.
 */

// Fixture markers for verification
const FIXTURE_MARKERS = {
	standard: {
		skill: "FIXTURE_MARKER:STANDARD_SKILL",
		rule: "FIXTURE_MARKER:STANDARD_RULE",
	},
	"claude-plugin": {
		skill: "FIXTURE_MARKER:CLAUDE_PLUGIN_SKILL",
	},
	"bare-skills": {
		skill: "FIXTURE_MARKER:BARE_SKILL",
	},
} as const;

// Map of example files to their expected capabilities
const EXAMPLE_EXPECTATIONS: Record<
	string,
	{
		capabilities: string[];
		skip?: boolean;
		skipReason?: string;
	}
> = {
	"basic.toml": {
		capabilities: ["standard"],
	},
	"profiles.toml": {
		capabilities: ["standard"], // Default profile only uses standard
	},
	"github-sources.toml": {
		capabilities: ["standard", "claude-plugin"],
	},
	"comprehensive.toml": {
		capabilities: ["standard"], // Default profile uses standard
	},
	"local-dev.toml": {
		capabilities: [],
		skip: true,
		skipReason: "All sources are commented - documentation only",
	},
	"mcp.toml": {
		capabilities: ["demo"],
	},
};

// Get all example .toml files
const examplesDir = resolve(__dirname);
const exampleFiles = readdirSync(examplesDir)
	.filter((f) => f.endsWith(".toml"))
	.sort();

/**
 * Find files containing a marker string recursively
 */
function findFilesWithMarker(dir: string, marker: string): string[] {
	const found: string[] = [];

	function search(currentDir: string) {
		if (!existsSync(currentDir)) return;

		const entries = readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		for (const entry of entries) {
			const fullPath = resolve(currentDir, entry.name);
			if (entry.isDirectory()) {
				search(fullPath);
			} else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdc"))) {
				try {
					const content = readFileSync(fullPath, "utf-8");
					if (content.includes(marker)) {
						found.push(fullPath);
					}
				} catch {
					// Ignore read errors
				}
			}
		}
	}

	search(dir);
	return found;
}

describe("examples integration", () => {
	setupTestDir("examples-integration-", { chdir: true });

	for (const exampleFile of exampleFiles) {
		const exampleName = basename(exampleFile, ".toml");
		const expectations = EXAMPLE_EXPECTATIONS[exampleFile];

		if (!expectations) {
			test.skip(`${exampleName}.toml - no expectations defined`, () => {});
			continue;
		}

		if (expectations.skip) {
			test.skip(`${exampleName}.toml - ${expectations.skipReason}`, () => {});
			continue;
		}

		test(
			`${exampleName}.toml syncs capabilities from GitHub`,
			async () => {
				// Copy example file directly - no modifications
				const examplePath = resolve(examplesDir, exampleFile);
				const config = readFileSync(examplePath, "utf-8");
				await writeFile("omni.toml", config, "utf-8");

				// Run init with claude-code provider
				await captureConsole(async () => {
					await runInit({}, "claude-code");
				});

				// Run sync
				const { stderr } = await captureConsole(async () => {
					await runSync();
				});

				// Verify basic structure was created
				expect(existsSync(".omni")).toBe(true);
				expect(existsSync(".omni/capabilities")).toBe(true);
				expect(existsSync("CLAUDE.md")).toBe(true);

				// Verify expected capabilities were synced
				const syncedCapabilities = existsSync(".omni/capabilities")
					? readdirSync(".omni/capabilities")
							.filter((f) => existsSync(`.omni/capabilities/${f}/capability.toml`))
							.sort()
					: [];

				for (const expectedCap of expectations.capabilities) {
					expect(syncedCapabilities).toContain(expectedCap);
				}

				// Verify no critical errors in output
				const criticalErrors = stderr.filter(
					(line: string) =>
						line.includes("Error:") && !line.includes("Warning:") && !line.includes("not found"),
				);
				expect(criticalErrors).toEqual([]);

				// Verify fixture markers for each expected capability
				for (const capId of expectations.capabilities) {
					const markers = FIXTURE_MARKERS[capId as keyof typeof FIXTURE_MARKERS];
					if (!markers) continue;

					if ("skill" in markers) {
						// Find files with the skill marker
						const skillFiles = findFilesWithMarker(".", markers.skill);
						expect(skillFiles.length).toBeGreaterThan(0);
					}

					if ("rule" in markers) {
						// Find files with the rule marker
						const ruleFiles = findFilesWithMarker(".", markers.rule);
						expect(ruleFiles.length).toBeGreaterThan(0);
					}
				}
			},
			{ timeout: 30000 },
		);
	}
});

describe("fixture markers validation", () => {
	setupTestDir("fixture-markers-", { chdir: true });

	test(
		"standard fixture produces skill and rule output",
		async () => {
			const config = `
[capabilities.sources]
standard = { source = "github:frmlabz/omnidev", path = "examples/fixtures/standard" }

[profiles.default]
capabilities = ["standard"]
`;
			await writeFile("omni.toml", config, "utf-8");

			await captureConsole(async () => {
				await runInit({}, "claude-code");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Verify skill marker is present
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.skill);
			expect(skillFiles.length).toBeGreaterThan(0);

			// Verify rule marker is present
			const ruleFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.rule);
			expect(ruleFiles.length).toBeGreaterThan(0);
		},
		{ timeout: 30000 },
	);

	test(
		"claude-plugin fixture is auto-wrapped",
		async () => {
			const config = `
[capabilities.sources]
claude-plugin = { source = "github:frmlabz/omnidev", path = "examples/fixtures/claude-plugin" }

[profiles.default]
capabilities = ["claude-plugin"]
`;
			await writeFile("omni.toml", config, "utf-8");

			await captureConsole(async () => {
				await runInit({}, "claude-code");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Verify skill marker is present
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS["claude-plugin"].skill);
			expect(skillFiles.length).toBeGreaterThan(0);
		},
		{ timeout: 30000 },
	);

	test(
		"bare-skills fixture is auto-wrapped",
		async () => {
			const config = `
[capabilities.sources]
bare-skills = { source = "github:frmlabz/omnidev", path = "examples/fixtures/bare-skills" }

[profiles.default]
capabilities = ["bare-skills"]
`;
			await writeFile("omni.toml", config, "utf-8");

			await captureConsole(async () => {
				await runInit({}, "claude-code");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Verify skill marker is present
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS["bare-skills"].skill);
			expect(skillFiles.length).toBeGreaterThan(0);
		},
		{ timeout: 30000 },
	);
});

describe("provider adapters", () => {
	setupTestDir("provider-adapters-", { chdir: true });

	const standardConfig = `
[capabilities.sources]
standard = { source = "github:frmlabz/omnidev", path = "examples/fixtures/standard" }

[profiles.default]
capabilities = ["standard"]
`;

	test(
		"claude-code adapter writes correct files",
		async () => {
			await writeFile("omni.toml", standardConfig, "utf-8");

			await captureConsole(async () => {
				await runInit({}, "claude-code");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Verify claude-code specific files
			expect(existsSync("CLAUDE.md")).toBe(true);
			expect(existsSync(".claude/skills")).toBe(true);
			// Note: .claude/settings.json is only written when hooks are present

			// Verify CLAUDE.md contains instructions
			const claudeMd = readFileSync("CLAUDE.md", "utf-8");
			expect(claudeMd).toContain("## Rules");

			// Verify skills were written
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.skill);
			expect(skillFiles.length).toBeGreaterThan(0);
			expect(skillFiles.some((f) => f.includes(".claude/skills"))).toBe(true);
		},
		{ timeout: 30000 },
	);

	test(
		"cursor adapter writes correct files",
		async () => {
			await writeFile("omni.toml", standardConfig, "utf-8");

			await captureConsole(async () => {
				await runInit({}, "cursor");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Verify cursor specific files
			expect(existsSync("CLAUDE.md")).toBe(true);
			expect(existsSync(".claude/skills")).toBe(true);
			expect(existsSync(".cursor/rules")).toBe(true);

			// Verify CLAUDE.md contains instructions
			const claudeMd = readFileSync("CLAUDE.md", "utf-8");
			expect(claudeMd).toContain("## Rules");

			// Verify skills were written to .claude/skills
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.skill);
			expect(skillFiles.length).toBeGreaterThan(0);
			expect(skillFiles.some((f) => f.includes(".claude/skills"))).toBe(true);

			// Verify rules were written to .cursor/rules
			const ruleFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.rule);
			expect(ruleFiles.length).toBeGreaterThan(0);
			expect(ruleFiles.some((f) => f.includes(".cursor/rules"))).toBe(true);
		},
		{ timeout: 30000 },
	);

	test(
		"codex adapter writes correct files",
		async () => {
			await writeFile("omni.toml", standardConfig, "utf-8");

			await captureConsole(async () => {
				await runInit({}, "codex");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Verify codex specific files
			expect(existsSync("AGENTS.md")).toBe(true);
			expect(existsSync(".codex/skills")).toBe(true);

			// Verify AGENTS.md contains instructions
			const agentsMd = readFileSync("AGENTS.md", "utf-8");
			expect(agentsMd).toContain("## Rules");

			// Verify skills were written to .codex/skills
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.skill);
			expect(skillFiles.length).toBeGreaterThan(0);
			expect(skillFiles.some((f) => f.includes(".codex/skills"))).toBe(true);
		},
		{ timeout: 30000 },
	);

	test(
		"opencode adapter writes correct files",
		async () => {
			await writeFile("omni.toml", standardConfig, "utf-8");

			await captureConsole(async () => {
				await runInit({}, "opencode");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Verify opencode specific files
			expect(existsSync("AGENTS.md")).toBe(true);
			expect(existsSync(".opencode/skills")).toBe(true);

			// Verify AGENTS.md contains instructions
			const agentsMd = readFileSync("AGENTS.md", "utf-8");
			expect(agentsMd).toContain("## Rules");

			// Verify skills were written to .opencode/skills
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.skill);
			expect(skillFiles.length).toBeGreaterThan(0);
			expect(skillFiles.some((f) => f.includes(".opencode/skills"))).toBe(true);
		},
		{ timeout: 30000 },
	);

	test(
		"multiple providers with shared files (deduplication)",
		async () => {
			await writeFile("omni.toml", standardConfig, "utf-8");

			// Enable both claude-code and cursor (they share CLAUDE.md and .claude/skills)
			await captureConsole(async () => {
				await runInit({}, "claude-code,cursor");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Both adapters share these files - verify they exist (written once via deduplication)
			expect(existsSync("CLAUDE.md")).toBe(true);
			expect(existsSync(".claude/skills")).toBe(true);

			// Cursor-specific files
			expect(existsSync(".cursor/rules")).toBe(true);

			// Note: .claude/settings.json is only written when hooks are present

			// Verify content
			const claudeMd = readFileSync("CLAUDE.md", "utf-8");
			expect(claudeMd).toContain("## Rules");

			// Verify skills and rules
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.skill);
			expect(skillFiles.length).toBeGreaterThan(0);

			const ruleFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.rule);
			expect(ruleFiles.length).toBeGreaterThan(0);
		},
		{ timeout: 30000 },
	);

	test(
		"codex and opencode with shared AGENTS.md (deduplication)",
		async () => {
			await writeFile("omni.toml", standardConfig, "utf-8");

			// Enable both codex and opencode (they share AGENTS.md)
			await captureConsole(async () => {
				await runInit({}, "codex,opencode");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Both adapters share AGENTS.md - verify it exists (written once via deduplication)
			expect(existsSync("AGENTS.md")).toBe(true);

			// Each adapter has its own skills directory
			expect(existsSync(".codex/skills")).toBe(true);
			expect(existsSync(".opencode/skills")).toBe(true);

			// Verify AGENTS.md content
			const agentsMd = readFileSync("AGENTS.md", "utf-8");
			expect(agentsMd).toContain("## Rules");

			// Verify skills were written to both locations
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.skill);
			expect(skillFiles.length).toBeGreaterThan(0);
			expect(skillFiles.some((f) => f.includes(".codex/skills"))).toBe(true);
			expect(skillFiles.some((f) => f.includes(".opencode/skills"))).toBe(true);
		},
		{ timeout: 30000 },
	);

	test(
		"all providers enabled together",
		async () => {
			await writeFile("omni.toml", standardConfig, "utf-8");

			// Enable all providers
			await captureConsole(async () => {
				await runInit({}, "claude-code,cursor,codex,opencode");
			});

			await captureConsole(async () => {
				await runSync();
			});

			// Claude-based providers
			expect(existsSync("CLAUDE.md")).toBe(true);
			expect(existsSync(".claude/skills")).toBe(true);
			expect(existsSync(".cursor/rules")).toBe(true);
			// Note: .claude/settings.json is only written when hooks are present

			// Codex-based providers
			expect(existsSync("AGENTS.md")).toBe(true);
			expect(existsSync(".codex/skills")).toBe(true);
			expect(existsSync(".opencode/skills")).toBe(true);

			// Verify both instruction files have content
			const claudeMd = readFileSync("CLAUDE.md", "utf-8");
			expect(claudeMd).toContain("## Rules");

			const agentsMd = readFileSync("AGENTS.md", "utf-8");
			expect(agentsMd).toContain("## Rules");

			// Verify skills in all locations
			const skillFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.skill);
			expect(skillFiles.some((f) => f.includes(".claude/skills"))).toBe(true);
			expect(skillFiles.some((f) => f.includes(".codex/skills"))).toBe(true);
			expect(skillFiles.some((f) => f.includes(".opencode/skills"))).toBe(true);

			// Verify rules in cursor
			const ruleFiles = findFilesWithMarker(".", FIXTURE_MARKERS.standard.rule);
			expect(ruleFiles.some((f) => f.includes(".cursor/rules"))).toBe(true);
		},
		{ timeout: 30000 },
	);
});
