import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import type { LoadedCapability, McpConfig } from "../types";
import type { ResourceManifest } from "../state/manifest";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import {
	type McpServerStdioConfig,
	type McpServerHttpConfig,
	type McpServerSseConfig,
	readMcpJson,
	syncMcpJson,
	writeMcpJson,
} from "./manager";

async function writeTextFile(path: string, content: string): Promise<void> {
	await writeFile(path, content, "utf-8");
}

async function readTextFile(path: string): Promise<string> {
	return await readFile(path, "utf-8");
}

describe("mcp-json manager", () => {
	setupTestDir("mcp-json-test-", { chdir: true, createOmniDir: true });

	const createEmptyManifest = (): ResourceManifest => ({
		version: 1,
		syncedAt: new Date().toISOString(),
		capabilities: {},
	});

	describe("readMcpJson", () => {
		test("returns empty config when file does not exist", async () => {
			const config = await readMcpJson();
			expect(config).toEqual({ mcpServers: {} });
		});

		test("reads existing .mcp.json file", async () => {
			const existingConfig = {
				mcpServers: {
					myserver: {
						command: "node",
						args: ["server.js"],
					},
				},
			};
			await writeTextFile(".mcp.json", JSON.stringify(existingConfig));

			const config = await readMcpJson();
			expect(config).toEqual(existingConfig);
		});

		test("handles invalid JSON gracefully", async () => {
			await writeTextFile(".mcp.json", "invalid json {{{");

			const config = await readMcpJson();
			expect(config).toEqual({ mcpServers: {} });
		});

		test("handles missing mcpServers field", async () => {
			await writeTextFile(".mcp.json", JSON.stringify({ other: "field" }));

			const config = await readMcpJson();
			expect(config).toEqual({ mcpServers: {} });
		});
	});

	describe("writeMcpJson", () => {
		test("writes config to .mcp.json", async () => {
			const config = {
				mcpServers: {
					test: {
						command: "test-cmd",
						args: ["arg1", "arg2"],
					},
				},
			};

			await writeMcpJson(config);

			const content = await readTextFile(".mcp.json");
			expect(JSON.parse(content)).toEqual(config);
		});

		test("overwrites existing .mcp.json", async () => {
			await writeTextFile(".mcp.json", JSON.stringify({ mcpServers: { old: { command: "old" } } }));

			const newConfig = {
				mcpServers: {
					new: { command: "new" },
				},
			};

			await writeMcpJson(newConfig);

			const content = await readTextFile(".mcp.json");
			expect(JSON.parse(content)).toEqual(newConfig);
		});

		test("formats JSON with indentation", async () => {
			const config = {
				mcpServers: {
					test: { command: "cmd" },
				},
			};

			await writeMcpJson(config);

			const content = await readTextFile(".mcp.json");
			expect(content).toContain("\n");
			expect(content).toContain("  ");
		});
	});

	describe("syncMcpJson", () => {
		const createMockCapability = (id: string, mcp?: McpConfig): LoadedCapability => ({
			id,
			path: `/path/to/${id}`,
			config: {
				capability: { id, name: id, version: "1.0.0", description: "" },
				mcp,
			},
			skills: [],
			rules: [],
			docs: [],
			subagents: [],
			commands: [],
			exports: {},
		});

		describe("MCP wrapping", () => {
			test("adds MCP servers using capability ID", async () => {
				const capabilities = [
					createMockCapability("context7", {
						command: "npx",
						args: ["-y", "@upstash/context7-mcp"],
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				expect(config.mcpServers).toHaveProperty("context7");
				expect(config.mcpServers["context7"]).toEqual({
					command: "npx",
					args: ["-y", "@upstash/context7-mcp"],
				});
			});

			test("does not add entries for capabilities without MCP", async () => {
				const capabilities = [
					createMockCapability("tasks"), // No MCP
					createMockCapability("context7", { command: "npx", args: ["context7-mcp"] }),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				expect(config.mcpServers).not.toHaveProperty("tasks");
				expect(config.mcpServers).toHaveProperty("context7");
			});

			test("includes env when present in MCP config", async () => {
				const capabilities = [
					createMockCapability("my-cap", {
						command: "node",
						args: ["server.js"],
						env: { API_KEY: "secret", DEBUG: "true" },
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				const serverConfig = config.mcpServers["my-cap"] as McpServerStdioConfig;
				expect(serverConfig.env).toEqual({
					API_KEY: "secret",
					DEBUG: "true",
				});
			});

			test("removes previously managed MCP from manifest", async () => {
				// Setup: pre-populate .mcp.json with an old MCP
				await writeTextFile(
					".mcp.json",
					JSON.stringify({
						mcpServers: {
							oldcap: { command: "npx", args: ["old-mcp"] },
							userserver: { command: "node", args: ["user.js"] },
						},
					}),
				);

				// Previous manifest tracks oldcap as managed
				const previousManifest: ResourceManifest = {
					version: 1,
					syncedAt: new Date().toISOString(),
					capabilities: {
						oldcap: { skills: [], rules: [], commands: [], subagents: [], mcps: ["oldcap"] },
					},
				};

				const capabilities = [
					createMockCapability("context7", { command: "npx", args: ["context7-mcp"] }),
				];

				await syncMcpJson(capabilities, previousManifest);

				const config = await readMcpJson();
				expect(config.mcpServers).not.toHaveProperty("oldcap"); // Removed (was managed)
				expect(config.mcpServers).toHaveProperty("userserver"); // Preserved (not managed)
				expect(config.mcpServers).toHaveProperty("context7"); // Added
			});

			test("preserves user MCPs", async () => {
				await writeTextFile(
					".mcp.json",
					JSON.stringify({
						mcpServers: {
							myserver: { command: "node", args: ["my-server.js"] },
						},
					}),
				);

				const capabilities = [
					createMockCapability("context7", { command: "npx", args: ["context7-mcp"] }),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				expect(config.mcpServers).toHaveProperty("myserver");
				expect(config.mcpServers).toHaveProperty("context7");
			});

			test("does not add entries when no MCP capabilities", async () => {
				const capabilities = [
					createMockCapability("tasks"), // No MCP
					createMockCapability("ralph"), // No MCP
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				expect(config.mcpServers).not.toHaveProperty("tasks");
				expect(config.mcpServers).not.toHaveProperty("ralph");
			});
		});

		describe("capability toggle", () => {
			test("enabling MCP capability adds its entry", async () => {
				// Start with no MCP capabilities
				let manifest = createEmptyManifest();
				await syncMcpJson([createMockCapability("tasks")], manifest);

				let config = await readMcpJson();
				expect(Object.keys(config.mcpServers)).toHaveLength(0);

				// Enable MCP capability - update manifest to track tasks (no mcps)
				manifest = {
					version: 1,
					syncedAt: new Date().toISOString(),
					capabilities: {
						tasks: { skills: [], rules: [], commands: [], subagents: [], mcps: [] },
					},
				};
				await syncMcpJson(
					[
						createMockCapability("tasks"),
						createMockCapability("context7", { command: "npx", args: ["context7-mcp"] }),
					],
					manifest,
					{ silent: true },
				);

				config = await readMcpJson();
				expect(config.mcpServers).toHaveProperty("context7");
			});

			test("disabling MCP capability removes its entry", async () => {
				// Start with MCP capability
				let manifest = createEmptyManifest();
				await syncMcpJson(
					[createMockCapability("context7", { command: "npx", args: ["context7-mcp"] })],
					manifest,
					{ silent: true },
				);

				let config = await readMcpJson();
				expect(config.mcpServers).toHaveProperty("context7");

				// Disable the capability - manifest now tracks context7 with its MCP
				manifest = {
					version: 1,
					syncedAt: new Date().toISOString(),
					capabilities: {
						context7: { skills: [], rules: [], commands: [], subagents: [], mcps: ["context7"] },
					},
				};
				await syncMcpJson([createMockCapability("tasks")], manifest);

				config = await readMcpJson();
				expect(config.mcpServers).not.toHaveProperty("context7");
			});
		});

		describe("multiple MCP capabilities", () => {
			test("adds all MCP capabilities", async () => {
				const capabilities = [
					createMockCapability("context7", { command: "npx", args: ["context7-mcp"] }),
					createMockCapability("playwright", { command: "npx", args: ["playwright-mcp"] }),
					createMockCapability("tasks"), // No MCP
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				expect(config.mcpServers).toHaveProperty("context7");
				expect(config.mcpServers).toHaveProperty("playwright");
				expect(config.mcpServers).not.toHaveProperty("tasks");
			});
		});

		describe("transport types", () => {
			test("stdio transport - local process (default)", async () => {
				const capabilities = [
					createMockCapability("filesystem", {
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
						transport: "stdio",
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				const serverConfig = config.mcpServers["filesystem"] as McpServerStdioConfig;
				expect(serverConfig.command).toBe("npx");
				expect(serverConfig.args).toEqual([
					"-y",
					"@modelcontextprotocol/server-filesystem",
					"/path/to/dir",
				]);
				expect("type" in serverConfig).toBe(false);
			});

			test("stdio transport without explicit transport field", async () => {
				const capabilities = [
					createMockCapability("local-server", {
						command: "node",
						args: ["server.js"],
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				const serverConfig = config.mcpServers["local-server"] as McpServerStdioConfig;
				expect(serverConfig.command).toBe("node");
				expect(serverConfig.args).toEqual(["server.js"]);
				expect("type" in serverConfig).toBe(false);
			});

			test("http transport - remote server", async () => {
				const capabilities = [
					createMockCapability("notion", {
						transport: "http",
						url: "https://mcp.notion.com/mcp",
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				const serverConfig = config.mcpServers["notion"] as McpServerHttpConfig;
				expect(serverConfig.type).toBe("http");
				expect(serverConfig.url).toBe("https://mcp.notion.com/mcp");
				expect("command" in serverConfig).toBe(false);
			});

			test("http transport with authentication headers", async () => {
				const capabilities = [
					createMockCapability("secure-api", {
						transport: "http",
						url: "https://api.example.com/mcp",
						headers: {
							Authorization: "Bearer your-token",
							"X-Custom-Header": "value",
						},
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				const serverConfig = config.mcpServers["secure-api"] as McpServerHttpConfig;
				expect(serverConfig.type).toBe("http");
				expect(serverConfig.url).toBe("https://api.example.com/mcp");
				expect(serverConfig.headers).toEqual({
					Authorization: "Bearer your-token",
					"X-Custom-Header": "value",
				});
			});

			test("sse transport - server-sent events (deprecated)", async () => {
				const capabilities = [
					createMockCapability("asana", {
						transport: "sse",
						url: "https://mcp.asana.com/sse",
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				const serverConfig = config.mcpServers["asana"] as McpServerSseConfig;
				expect(serverConfig.type).toBe("sse");
				expect(serverConfig.url).toBe("https://mcp.asana.com/sse");
				expect("command" in serverConfig).toBe(false);
			});

			test("sse transport with authentication headers", async () => {
				const capabilities = [
					createMockCapability("private-sse", {
						transport: "sse",
						url: "https://api.company.com/sse",
						headers: {
							"X-API-Key": "your-key-here",
						},
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();
				const serverConfig = config.mcpServers["private-sse"] as McpServerSseConfig;
				expect(serverConfig.type).toBe("sse");
				expect(serverConfig.url).toBe("https://api.company.com/sse");
				expect(serverConfig.headers).toEqual({
					"X-API-Key": "your-key-here",
				});
			});

			test("mixed transport types in same sync", async () => {
				const capabilities = [
					createMockCapability("local-fs", {
						command: "npx",
						args: ["-y", "filesystem-mcp"],
						transport: "stdio",
					}),
					createMockCapability("remote-notion", {
						transport: "http",
						url: "https://mcp.notion.com/mcp",
					}),
					createMockCapability("remote-sse", {
						transport: "sse",
						url: "https://api.example.com/sse",
						headers: { "X-Key": "test" },
					}),
				];

				await syncMcpJson(capabilities, createEmptyManifest());

				const config = await readMcpJson();

				// stdio
				const stdioConfig = config.mcpServers["local-fs"] as McpServerStdioConfig;
				expect(stdioConfig.command).toBe("npx");
				expect("type" in stdioConfig).toBe(false);

				// http
				const httpConfig = config.mcpServers["remote-notion"] as McpServerHttpConfig;
				expect(httpConfig.type).toBe("http");
				expect(httpConfig.url).toBe("https://mcp.notion.com/mcp");

				// sse
				const sseConfig = config.mcpServers["remote-sse"] as McpServerSseConfig;
				expect(sseConfig.type).toBe("sse");
				expect(sseConfig.url).toBe("https://api.example.com/sse");
				expect(sseConfig.headers).toEqual({ "X-Key": "test" });
			});

			test("throws error for http transport without url", async () => {
				const capabilities = [
					createMockCapability("bad-http", {
						transport: "http",
						// Missing url
					}),
				];

				await expect(syncMcpJson(capabilities, createEmptyManifest())).rejects.toThrow(
					"HTTP transport requires a URL",
				);
			});

			test("throws error for sse transport without url", async () => {
				const capabilities = [
					createMockCapability("bad-sse", {
						transport: "sse",
						// Missing url
					}),
				];

				await expect(syncMcpJson(capabilities, createEmptyManifest())).rejects.toThrow(
					"SSE transport requires a URL",
				);
			});

			test("throws error for stdio transport without command", async () => {
				const capabilities = [
					createMockCapability("bad-stdio", {
						transport: "stdio",
						// Missing command
					}),
				];

				await expect(syncMcpJson(capabilities, createEmptyManifest())).rejects.toThrow(
					"stdio transport requires a command",
				);
			});
		});
	});
});
