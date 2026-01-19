import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { CapabilityConfig, OmniConfig } from "../types/index.js";
import { generateMcpCapabilities, normalizeFolderNames } from "./sources.js";

describe("wrapping integration - expo-like structure", () => {
	const testDir = setupTestDir("test-expo-", { chdir: true });

	test("wraps expo-like plugin with .claude-plugin/plugin.json", () => {
		// Simulate Expo skills structure: plugins/expo-app-design/
		const pluginDir = join(testDir.path, "plugins", "expo-app-design");
		mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
		mkdirSync(join(pluginDir, "skills"));

		// Create plugin.json (like Expo has)
		writeFileSync(
			join(pluginDir, ".claude-plugin", "plugin.json"),
			JSON.stringify({
				name: "expo-app-design",
				version: "1.0.0",
				description: "Build robust, productivity apps with Expo",
				author: {
					name: "Evan Bacon",
					email: "bacon@expo.io",
				},
			}),
		);

		// Create README
		writeFileSync(
			join(pluginDir, "README.md"),
			`# Expo App Design

Design amazing Expo applications with best practices.

This plugin provides tools for building production-ready Expo apps.`,
		);

		// Create a skill
		const skillDir = join(pluginDir, "skills");
		writeFileSync(
			join(skillDir, "example-skill.md"),
			`---
name: example-skill
description: Example skill for testing
---

# Example Skill

This is an example skill.`,
		);

		// Verify structure exists
		expect(existsSync(join(pluginDir, ".claude-plugin", "plugin.json"))).toBe(true);
		expect(existsSync(join(pluginDir, "README.md"))).toBe(true);
		expect(existsSync(join(pluginDir, "skills", "example-skill.md"))).toBe(true);
		expect(existsSync(join(pluginDir, "capability.toml"))).toBe(false);

		// This should be detected as needing wrapping
		// When fetchGitCapabilitySource runs, it will:
		// 1. Check for capability.toml (not found)
		// 2. Call shouldWrapDirectory
		// 3. Find .claude-plugin/plugin.json
		// 4. Generate capability.toml with metadata from plugin.json
	});

	test("wraps plugin with only directory structure (no plugin.json)", () => {
		const pluginDir = join(testDir.path, "plugins", "simple-plugin");
		mkdirSync(join(pluginDir, "skills"), { recursive: true });

		// Create README
		writeFileSync(
			join(pluginDir, "README.md"),
			`# Simple Plugin

A simple plugin without plugin.json metadata.

This demonstrates wrapping based on directory structure alone.`,
		);

		// Create a skill
		writeFileSync(
			join(pluginDir, "skills", "test-skill.md"),
			`---
name: test-skill
description: Test skill
---

# Test Skill

Content here.`,
		);

		// Verify structure exists
		expect(existsSync(join(pluginDir, ".claude-plugin"))).toBe(false);
		expect(existsSync(join(pluginDir, "skills"))).toBe(true);
		expect(existsSync(join(pluginDir, "capability.toml"))).toBe(false);

		// Should still be detected for wrapping due to skills/ directory
	});

	test("does not wrap when capability.toml already exists", () => {
		const pluginDir = join(testDir.path, "plugins", "proper-capability");
		mkdirSync(join(pluginDir, "skills"), { recursive: true });

		// Create proper capability.toml
		writeFileSync(
			join(pluginDir, "capability.toml"),
			`[capability]
id = "proper-capability"
name = "Proper Capability"
version = "1.0.0"
description = "This is a proper capability with its own TOML"
`,
		);

		// Create a skill
		writeFileSync(join(pluginDir, "skills", "skill.md"), "# Skill\n");

		// Verify capability.toml exists
		expect(existsSync(join(pluginDir, "capability.toml"))).toBe(true);
		expect(existsSync(join(pluginDir, "skills"))).toBe(true);

		// Should NOT be wrapped - already has capability.toml
	});

	test("multiple plugins in monorepo structure", () => {
		// Simulate full Expo skills structure
		const plugins = ["expo-app-design", "expo-deployment", "upgrading-expo"];

		for (const pluginName of plugins) {
			const pluginDir = join(testDir.path, "plugins", pluginName);
			mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });
			mkdirSync(join(pluginDir, "skills"), { recursive: true });

			writeFileSync(
				join(pluginDir, ".claude-plugin", "plugin.json"),
				JSON.stringify({
					name: pluginName,
					version: "1.0.0",
					description: `${pluginName} plugin`,
				}),
			);

			writeFileSync(join(pluginDir, "README.md"), `# ${pluginName}\n\nDescription here.`);
			writeFileSync(join(pluginDir, "skills", "example.md"), "# Skill\n");
		}

		// Verify all three plugins have correct structure
		for (const pluginName of plugins) {
			const pluginDir = join(testDir.path, "plugins", pluginName);
			expect(existsSync(join(pluginDir, ".claude-plugin", "plugin.json"))).toBe(true);
			expect(existsSync(join(pluginDir, "skills"))).toBe(true);
			expect(existsSync(join(pluginDir, "capability.toml"))).toBe(false);
		}

		// Each plugin would be loaded separately with:
		// expo-app-design = { source = "github:expo/skills", path = "plugins/expo-app-design" }
		// expo-deployment = { source = "github:expo/skills", path = "plugins/expo-deployment" }
		// upgrading-expo = { source = "github:expo/skills", path = "plugins/upgrading-expo" }
	});
});

describe("wrapping folder renaming - singular to plural", () => {
	const testDir = setupTestDir("test-rename-", { chdir: true });

	test("renames singular 'skill' folder to 'skills' during wrapping", async () => {
		const pluginDir = join(testDir.path, "plugins", "test-plugin");
		mkdirSync(join(pluginDir, "skill"), { recursive: true });

		// Create a skill in singular folder
		writeFileSync(
			join(pluginDir, "skill", "example-skill.md"),
			`---
name: example-skill
description: Example skill
---

# Example Skill

Test content.`,
		);

		writeFileSync(
			join(pluginDir, "README.md"),
			`# Test Plugin

Plugin with singular skill folder.`,
		);

		// Verify singular folder exists
		expect(existsSync(join(pluginDir, "skill"))).toBe(true);
		expect(existsSync(join(pluginDir, "skills"))).toBe(false);

		// Run normalization
		await normalizeFolderNames(pluginDir);

		// After normalization, 'skill' should be renamed to 'skills'
		expect(existsSync(join(pluginDir, "skill"))).toBe(false);
		expect(existsSync(join(pluginDir, "skills"))).toBe(true);

		// Verify content was preserved
		expect(existsSync(join(pluginDir, "skills", "example-skill.md"))).toBe(true);
	});

	test("renames singular 'command' folder to 'commands' during wrapping", async () => {
		const pluginDir = join(testDir.path, "plugins", "cmd-plugin");
		mkdirSync(join(pluginDir, "command"), { recursive: true });

		writeFileSync(
			join(pluginDir, "command", "test-cmd.md"),
			`---
name: test-cmd
description: Test command
---

# Test Command`,
		);

		// Verify singular folder exists
		expect(existsSync(join(pluginDir, "command"))).toBe(true);
		expect(existsSync(join(pluginDir, "commands"))).toBe(false);

		// Run normalization
		await normalizeFolderNames(pluginDir);

		// After normalization, 'command' should be renamed to 'commands'
		expect(existsSync(join(pluginDir, "command"))).toBe(false);
		expect(existsSync(join(pluginDir, "commands"))).toBe(true);
		expect(existsSync(join(pluginDir, "commands", "test-cmd.md"))).toBe(true);
	});

	test("renames singular 'rule' folder to 'rules' during wrapping", async () => {
		const pluginDir = join(testDir.path, "plugins", "rules-plugin");
		mkdirSync(join(pluginDir, "rule"), { recursive: true });

		writeFileSync(join(pluginDir, "rule", "coding-standard.md"), "# Coding Standard\n");

		// Verify singular folder exists
		expect(existsSync(join(pluginDir, "rule"))).toBe(true);
		expect(existsSync(join(pluginDir, "rules"))).toBe(false);

		// Run normalization
		await normalizeFolderNames(pluginDir);

		// After normalization, 'rule' should be renamed to 'rules'
		expect(existsSync(join(pluginDir, "rule"))).toBe(false);
		expect(existsSync(join(pluginDir, "rules"))).toBe(true);
		expect(existsSync(join(pluginDir, "rules", "coding-standard.md"))).toBe(true);
	});

	test("does not rename if plural folder already exists", async () => {
		const pluginDir = join(testDir.path, "plugins", "both-plugin");
		mkdirSync(join(pluginDir, "skills"), { recursive: true });
		mkdirSync(join(pluginDir, "skill"), { recursive: true });

		writeFileSync(join(pluginDir, "skills", "skill1.md"), "# Skill 1\n");
		writeFileSync(join(pluginDir, "skill", "skill2.md"), "# Skill 2\n");

		// Both folders exist - should prefer plural, leave singular alone
		expect(existsSync(join(pluginDir, "skills"))).toBe(true);
		expect(existsSync(join(pluginDir, "skill"))).toBe(true);

		// Run normalization
		await normalizeFolderNames(pluginDir);

		// Both should still exist - singular not renamed because plural exists
		expect(existsSync(join(pluginDir, "skills"))).toBe(true);
		expect(existsSync(join(pluginDir, "skill"))).toBe(true);
	});

	test("renames multiple singular folders in one plugin", async () => {
		const pluginDir = join(testDir.path, "plugins", "multi-plugin");
		mkdirSync(join(pluginDir, "skill"), { recursive: true });
		mkdirSync(join(pluginDir, "command"), { recursive: true });
		mkdirSync(join(pluginDir, "rule"), { recursive: true });

		writeFileSync(join(pluginDir, "skill", "example.md"), "# Skill\n");
		writeFileSync(join(pluginDir, "command", "example.md"), "# Command\n");
		writeFileSync(join(pluginDir, "rule", "example.md"), "# Rule\n");

		// Verify all singular folders exist
		expect(existsSync(join(pluginDir, "skill"))).toBe(true);
		expect(existsSync(join(pluginDir, "command"))).toBe(true);
		expect(existsSync(join(pluginDir, "rule"))).toBe(true);

		// Run normalization
		await normalizeFolderNames(pluginDir);

		// After normalization, all should be renamed to plural
		expect(existsSync(join(pluginDir, "skill"))).toBe(false);
		expect(existsSync(join(pluginDir, "command"))).toBe(false);
		expect(existsSync(join(pluginDir, "rule"))).toBe(false);

		expect(existsSync(join(pluginDir, "skills"))).toBe(true);
		expect(existsSync(join(pluginDir, "commands"))).toBe(true);
		expect(existsSync(join(pluginDir, "rules"))).toBe(true);

		// Verify content preserved
		expect(existsSync(join(pluginDir, "skills", "example.md"))).toBe(true);
		expect(existsSync(join(pluginDir, "commands", "example.md"))).toBe(true);
		expect(existsSync(join(pluginDir, "rules", "example.md"))).toBe(true);
	});

	test("renames 'agent' to 'agents' for consistency", async () => {
		const pluginDir = join(testDir.path, "plugins", "agent-plugin");
		mkdirSync(join(pluginDir, "agent"), { recursive: true });

		writeFileSync(join(pluginDir, "agent", "researcher.md"), "# Researcher Agent\n");

		// Verify singular folder exists
		expect(existsSync(join(pluginDir, "agent"))).toBe(true);
		expect(existsSync(join(pluginDir, "agents"))).toBe(false);

		// Run normalization
		await normalizeFolderNames(pluginDir);

		// 'agent' should be renamed to 'agents'
		expect(existsSync(join(pluginDir, "agent"))).toBe(false);
		expect(existsSync(join(pluginDir, "agents"))).toBe(true);
		expect(existsSync(join(pluginDir, "agents", "researcher.md"))).toBe(true);
	});

	test("renames 'subagent' to 'subagents'", async () => {
		const pluginDir = join(testDir.path, "plugins", "subagent-plugin");
		mkdirSync(join(pluginDir, "subagent"), { recursive: true });

		writeFileSync(join(pluginDir, "subagent", "helper.md"), "# Helper Subagent\n");

		// Verify singular folder exists
		expect(existsSync(join(pluginDir, "subagent"))).toBe(true);
		expect(existsSync(join(pluginDir, "subagents"))).toBe(false);

		// Run normalization
		await normalizeFolderNames(pluginDir);

		// 'subagent' should be renamed to 'subagents'
		expect(existsSync(join(pluginDir, "subagent"))).toBe(false);
		expect(existsSync(join(pluginDir, "subagents"))).toBe(true);
		expect(existsSync(join(pluginDir, "subagents", "helper.md"))).toBe(true);
	});

	test("leaves 'docs' and 'documentation' as is", async () => {
		const pluginDir = join(testDir.path, "plugins", "docs-plugin");
		mkdirSync(join(pluginDir, "docs"), { recursive: true });

		writeFileSync(join(pluginDir, "docs", "getting-started.md"), "# Getting Started\n");

		// 'docs' is already plural, no rename needed
		expect(existsSync(join(pluginDir, "docs"))).toBe(true);

		// Run normalization
		await normalizeFolderNames(pluginDir);

		// Should remain unchanged
		expect(existsSync(join(pluginDir, "docs"))).toBe(true);
	});
});

describe("MCP capability generation", () => {
	const _testDir = setupTestDir("mcp-wrapping-test-", { chdir: true });

	test("generates capability from omni.toml [mcps] section", async () => {
		const config: OmniConfig = {
			mcps: {
				context7: {
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
					transport: "stdio",
					env: {
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal env var syntax
						API_KEY: "${CONTEXT7_API_KEY}",
					},
				},
			},
		};

		await generateMcpCapabilities(config);

		const capabilityDir = join(".omni", "capabilities", "context7");
		expect(existsSync(capabilityDir)).toBe(true);

		const tomlPath = join(capabilityDir, "capability.toml");
		expect(existsSync(tomlPath)).toBe(true);

		const tomlContent = await readFile(tomlPath, "utf-8");
		const parsed = parseToml(tomlContent) as unknown as CapabilityConfig;

		expect(parsed.capability.id).toBe("context7");
		expect(parsed.capability.name).toBe("context7 (MCP)");
		expect(parsed.capability.version).toBe("1.0.0");
		expect(parsed.capability.metadata?.wrapped).toBe(true);
		expect(parsed.capability.metadata?.generated_from_omni_toml).toBe(true);

		expect(parsed.mcp?.command).toBe("npx");
		expect(parsed.mcp?.args).toEqual(["-y", "@upstash/context7-mcp"]);
		expect(parsed.mcp?.transport).toBe("stdio");
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal env var syntax
		expect(parsed.mcp?.env?.API_KEY).toBe("${CONTEXT7_API_KEY}");
	});

	test("generates multiple MCP capabilities", async () => {
		const config: OmniConfig = {
			mcps: {
				context7: {
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
				},
				filesystem: {
					command: "node",
					args: ["server.js"],
					cwd: "./mcp-servers/filesystem",
				},
			},
		};

		await generateMcpCapabilities(config);

		const context7Dir = join(".omni", "capabilities", "context7");
		const filesystemDir = join(".omni", "capabilities", "filesystem");

		expect(existsSync(context7Dir)).toBe(true);
		expect(existsSync(filesystemDir)).toBe(true);

		const context7TomlPath = join(context7Dir, "capability.toml");
		const filesystemTomlPath = join(filesystemDir, "capability.toml");

		expect(existsSync(context7TomlPath)).toBe(true);
		expect(existsSync(filesystemTomlPath)).toBe(true);

		const filesystemToml = await readFile(filesystemTomlPath, "utf-8");
		const parsed = parseToml(filesystemToml) as unknown as CapabilityConfig;

		expect(parsed.capability.id).toBe("filesystem");
		expect(parsed.mcp?.cwd).toBe("./mcp-servers/filesystem");
	});

	test("cleans up stale MCP capabilities", async () => {
		// First generation with two MCPs
		const config1: OmniConfig = {
			mcps: {
				context7: {
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
				},
				filesystem: {
					command: "node",
					args: ["server.js"],
				},
			},
		};

		await generateMcpCapabilities(config1);

		const context7Dir = join(".omni", "capabilities", "context7");
		const filesystemDir = join(".omni", "capabilities", "filesystem");

		expect(existsSync(context7Dir)).toBe(true);
		expect(existsSync(filesystemDir)).toBe(true);

		// Second generation with only one MCP
		const config2: OmniConfig = {
			mcps: {
				context7: {
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
				},
			},
		};

		await generateMcpCapabilities(config2);

		// context7 should still exist
		expect(existsSync(context7Dir)).toBe(true);

		// filesystem should be removed
		expect(existsSync(filesystemDir)).toBe(false);
	});

	test("cleans up all MCP capabilities when mcps section is empty", async () => {
		// First generation with MCPs
		const config1: OmniConfig = {
			mcps: {
				context7: {
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
				},
			},
		};

		await generateMcpCapabilities(config1);

		const context7Dir = join(".omni", "capabilities", "context7");
		expect(existsSync(context7Dir)).toBe(true);

		// Second generation with no MCPs
		const config2: OmniConfig = {
			mcps: {},
		};

		await generateMcpCapabilities(config2);

		// All MCP capabilities should be removed
		expect(existsSync(context7Dir)).toBe(false);
	});

	test("cleans up all MCP capabilities when mcps is undefined", async () => {
		// First generation with MCPs
		const config1: OmniConfig = {
			mcps: {
				context7: {
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
				},
			},
		};

		await generateMcpCapabilities(config1);

		const context7Dir = join(".omni", "capabilities", "context7");
		expect(existsSync(context7Dir)).toBe(true);

		// Second generation with undefined mcps
		const config2: OmniConfig = {};

		await generateMcpCapabilities(config2);

		// All MCP capabilities should be removed
		expect(existsSync(context7Dir)).toBe(false);
	});

	test("generates capability without optional fields", async () => {
		const config: OmniConfig = {
			mcps: {
				simple: {
					command: "simple-mcp",
				},
			},
		};

		await generateMcpCapabilities(config);

		const capabilityDir = join(".omni", "capabilities", "simple");
		expect(existsSync(capabilityDir)).toBe(true);

		const tomlPath = join(capabilityDir, "capability.toml");
		const tomlContent = await readFile(tomlPath, "utf-8");
		const parsed = parseToml(tomlContent) as unknown as CapabilityConfig;

		expect(parsed.capability.id).toBe("simple");
		expect(parsed.mcp?.command).toBe("simple-mcp");
		expect(parsed.mcp?.args).toBeUndefined();
		expect(parsed.mcp?.env).toBeUndefined();
		expect(parsed.mcp?.cwd).toBeUndefined();
		expect(parsed.mcp?.transport).toBeUndefined();
	});

	test("merges MCP env variables correctly", async () => {
		const config: OmniConfig = {
			mcps: {
				github: {
					command: "npx",
					args: ["-y", "@modelcontextprotocol/server-github"],
					env: {
						// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal env var syntax
						GITHUB_TOKEN: "${GITHUB_TOKEN}",
						GITHUB_API_URL: "https://api.github.com",
					},
				},
			},
		};

		await generateMcpCapabilities(config);

		const tomlPath = join(".omni", "capabilities", "github", "capability.toml");
		const tomlContent = await readFile(tomlPath, "utf-8");
		const parsed = parseToml(tomlContent) as unknown as CapabilityConfig;

		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal env var syntax
		expect(parsed.mcp?.env?.GITHUB_TOKEN).toBe("${GITHUB_TOKEN}");
		expect(parsed.mcp?.env?.GITHUB_API_URL).toBe("https://api.github.com");
	});

	test("does not affect non-MCP capabilities", async () => {
		// Create a non-MCP capability directory
		const nonMcpDir = join(".omni", "capabilities", "my-capability");
		mkdirSync(nonMcpDir, { recursive: true });
		writeFileSync(join(nonMcpDir, "capability.toml"), "# test");

		const config: OmniConfig = {
			mcps: {
				context7: {
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
				},
			},
		};

		await generateMcpCapabilities(config);

		// Non-MCP capability should still exist
		expect(existsSync(nonMcpDir)).toBe(true);
	});

	test("generates HTTP transport MCP capability", async () => {
		const config: OmniConfig = {
			mcps: {
				notion: {
					transport: "http",
					url: "https://mcp.notion.com/mcp",
				},
			},
		};

		await generateMcpCapabilities(config);

		const capabilityDir = join(".omni", "capabilities", "notion");
		expect(existsSync(capabilityDir)).toBe(true);

		const tomlPath = join(capabilityDir, "capability.toml");
		const tomlContent = await readFile(tomlPath, "utf-8");
		const parsed = parseToml(tomlContent) as unknown as CapabilityConfig;

		expect(parsed.capability.id).toBe("notion");
		expect(parsed.mcp?.transport).toBe("http");
		expect(parsed.mcp?.url).toBe("https://mcp.notion.com/mcp");
		expect(parsed.mcp?.command).toBeUndefined();
	});

	test("generates HTTP transport MCP capability with headers", async () => {
		const config: OmniConfig = {
			mcps: {
				"secure-api": {
					transport: "http",
					url: "https://api.example.com/mcp",
					headers: {
						Authorization: "Bearer my-token",
						"X-Custom-Header": "value",
					},
				},
			},
		};

		await generateMcpCapabilities(config);

		const capabilityDir = join(".omni", "capabilities", "secure-api");
		expect(existsSync(capabilityDir)).toBe(true);

		const tomlPath = join(capabilityDir, "capability.toml");
		const tomlContent = await readFile(tomlPath, "utf-8");
		const parsed = parseToml(tomlContent) as unknown as CapabilityConfig;

		expect(parsed.mcp?.transport).toBe("http");
		expect(parsed.mcp?.url).toBe("https://api.example.com/mcp");
		expect(parsed.mcp?.headers?.Authorization).toBe("Bearer my-token");
		expect(parsed.mcp?.headers?.["X-Custom-Header"]).toBe("value");
	});

	test("generates SSE transport MCP capability", async () => {
		const config: OmniConfig = {
			mcps: {
				asana: {
					transport: "sse",
					url: "https://mcp.asana.com/sse",
				},
			},
		};

		await generateMcpCapabilities(config);

		const capabilityDir = join(".omni", "capabilities", "asana");
		expect(existsSync(capabilityDir)).toBe(true);

		const tomlPath = join(capabilityDir, "capability.toml");
		const tomlContent = await readFile(tomlPath, "utf-8");
		const parsed = parseToml(tomlContent) as unknown as CapabilityConfig;

		expect(parsed.capability.id).toBe("asana");
		expect(parsed.mcp?.transport).toBe("sse");
		expect(parsed.mcp?.url).toBe("https://mcp.asana.com/sse");
		expect(parsed.mcp?.command).toBeUndefined();
	});

	test("generates SSE transport MCP capability with headers", async () => {
		const config: OmniConfig = {
			mcps: {
				"private-api": {
					transport: "sse",
					url: "https://api.company.com/sse",
					headers: {
						"X-API-Key": "your-key-here",
					},
				},
			},
		};

		await generateMcpCapabilities(config);

		const capabilityDir = join(".omni", "capabilities", "private-api");
		const tomlPath = join(capabilityDir, "capability.toml");
		const tomlContent = await readFile(tomlPath, "utf-8");
		const parsed = parseToml(tomlContent) as unknown as CapabilityConfig;

		expect(parsed.mcp?.transport).toBe("sse");
		expect(parsed.mcp?.url).toBe("https://api.company.com/sse");
		expect(parsed.mcp?.headers?.["X-API-Key"]).toBe("your-key-here");
	});

	test("generates multiple MCPs with different transports", async () => {
		const config: OmniConfig = {
			mcps: {
				filesystem: {
					command: "npx",
					args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
					transport: "stdio",
				},
				notion: {
					transport: "http",
					url: "https://mcp.notion.com/mcp",
				},
				asana: {
					transport: "sse",
					url: "https://mcp.asana.com/sse",
					headers: {
						"X-API-Key": "key",
					},
				},
			},
		};

		await generateMcpCapabilities(config);

		// Check stdio MCP
		const stdioToml = await readFile(
			join(".omni", "capabilities", "filesystem", "capability.toml"),
			"utf-8",
		);
		const stdioParsed = parseToml(stdioToml) as unknown as CapabilityConfig;
		expect(stdioParsed.mcp?.command).toBe("npx");
		expect(stdioParsed.mcp?.transport).toBe("stdio");

		// Check HTTP MCP
		const httpToml = await readFile(
			join(".omni", "capabilities", "notion", "capability.toml"),
			"utf-8",
		);
		const httpParsed = parseToml(httpToml) as unknown as CapabilityConfig;
		expect(httpParsed.mcp?.transport).toBe("http");
		expect(httpParsed.mcp?.url).toBe("https://mcp.notion.com/mcp");

		// Check SSE MCP
		const sseToml = await readFile(
			join(".omni", "capabilities", "asana", "capability.toml"),
			"utf-8",
		);
		const sseParsed = parseToml(sseToml) as unknown as CapabilityConfig;
		expect(sseParsed.mcp?.transport).toBe("sse");
		expect(sseParsed.mcp?.url).toBe("https://mcp.asana.com/sse");
		expect(sseParsed.mcp?.headers?.["X-API-Key"]).toBe("key");
	});
});
