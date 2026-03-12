import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import type { LoadedCapability, McpConfig, SyncBundle } from "@omnidev-ai/core";
import { buildCursorMcpConfig, CursorMcpJsonWriter } from "./mcp-json";

describe("CursorMcpJsonWriter", () => {
	const testDir = setupTestDir("cursor-mcp-json-writer-", { chdir: true });

	function createCapability(id: string, mcp?: McpConfig): LoadedCapability {
		const config: LoadedCapability["config"] = {
			capability: {
				id,
				name: id,
				version: "1.0.0",
				description: `Test capability ${id}`,
			},
		};
		if (mcp) {
			config.mcp = mcp;
		}
		return {
			id,
			path: `/fake/path/${id}`,
			config,
			skills: [],
			rules: [],
			docs: [],
			subagents: [],
			commands: [],
			exports: {},
		};
	}

	function createBundle(capabilities: LoadedCapability[]): SyncBundle {
		return {
			capabilities,
			skills: [],
			rules: [],
			docs: [],
			commands: [],
			subagents: [],
			instructionsContent: "",
		};
	}

	test("has correct id", () => {
		expect(CursorMcpJsonWriter.id).toBe("cursor-mcp-json");
	});

	test("writes MCPs with stdio transport", async () => {
		const mcp: McpConfig = {
			command: "npx",
			args: ["-y", "@upstash/context7-mcp"],
		};
		const bundle = createBundle([createCapability("context7", mcp)]);

		const result = await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".cursor/mcp.json"]);
		expect(existsSync(`${testDir.path}/.cursor/mcp.json`)).toBe(true);

		const content = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");
		const parsed = JSON.parse(content) as {
			mcpServers: Record<string, Record<string, unknown>>;
		};

		expect(parsed.mcpServers["context7"]).toBeDefined();
		expect(parsed.mcpServers["context7"]["command"]).toBe("npx");
		expect(parsed.mcpServers["context7"]["args"]).toEqual(["-y", "@upstash/context7-mcp"]);
	});

	test("writes MCPs with env", async () => {
		const mcp: McpConfig = {
			command: "node",
			args: ["server.js"],
			env: { DEBUG: "true", API_KEY: "secret" },
		};
		const bundle = createBundle([createCapability("my-server", mcp)]);

		const result = await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".cursor/mcp.json"]);

		const content = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");
		const parsed = JSON.parse(content) as {
			mcpServers: Record<string, Record<string, unknown>>;
		};

		expect(parsed.mcpServers["my-server"]).toBeDefined();
		expect(parsed.mcpServers["my-server"]["command"]).toBe("node");
		expect(parsed.mcpServers["my-server"]["args"]).toEqual(["server.js"]);
		expect(parsed.mcpServers["my-server"]["env"]).toEqual({
			DEBUG: "true",
			API_KEY: "secret",
		});
	});

	test("writes MCPs with http transport", async () => {
		const mcp: McpConfig = {
			transport: "http",
			url: "https://api.example.com/mcp",
			headers: { Authorization: "Bearer token123" },
		};
		const bundle = createBundle([createCapability("remote-mcp", mcp)]);

		const result = await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".cursor/mcp.json"]);

		const content = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");
		const parsed = JSON.parse(content) as {
			mcpServers: Record<string, Record<string, unknown>>;
		};

		expect(parsed.mcpServers["remote-mcp"]).toBeDefined();
		expect(parsed.mcpServers["remote-mcp"]["url"]).toBe("https://api.example.com/mcp");
		expect(parsed.mcpServers["remote-mcp"]["headers"]).toEqual({
			Authorization: "Bearer token123",
		});
		// Should not have stdio-specific fields
		expect(parsed.mcpServers["remote-mcp"]["command"]).toBeUndefined();
	});

	test("writes MCPs with sse transport", async () => {
		const mcp: McpConfig = {
			transport: "sse",
			url: "https://api.example.com/sse",
			headers: { "X-API-Key": "key123" },
		};
		const bundle = createBundle([createCapability("sse-mcp", mcp)]);

		const result = await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		// Cursor supports SSE (unlike Codex)
		expect(result.filesWritten).toEqual([".cursor/mcp.json"]);

		const content = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");
		const parsed = JSON.parse(content) as {
			mcpServers: Record<string, Record<string, unknown>>;
		};

		expect(parsed.mcpServers["sse-mcp"]).toBeDefined();
		expect(parsed.mcpServers["sse-mcp"]["url"]).toBe("https://api.example.com/sse");
		expect(parsed.mcpServers["sse-mcp"]["headers"]).toEqual({ "X-API-Key": "key123" });
	});

	test("handles multiple MCPs", async () => {
		const bundle = createBundle([
			createCapability("mcp-one", {
				command: "npx",
				args: ["-y", "@mcp/one"],
			}),
			createCapability("mcp-two", {
				command: "npx",
				args: ["-y", "@mcp/two"],
				env: { MODE: "production" },
			}),
			createCapability("mcp-http", {
				transport: "http",
				url: "https://mcp.example.com",
			}),
		]);

		const result = await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([".cursor/mcp.json"]);

		const content = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");
		const parsed = JSON.parse(content) as {
			mcpServers: Record<string, Record<string, unknown>>;
		};

		expect(Object.keys(parsed.mcpServers)).toHaveLength(3);
		expect(parsed.mcpServers["mcp-one"]).toBeDefined();
		expect(parsed.mcpServers["mcp-two"]).toBeDefined();
		expect(parsed.mcpServers["mcp-http"]).toBeDefined();
	});

	test("returns empty array when no MCPs", async () => {
		const bundle = createBundle([
			createCapability("no-mcp-cap"), // No MCP config
		]);

		const result = await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([]);
		expect(existsSync(`${testDir.path}/.cursor/mcp.json`)).toBe(false);
	});

	test("returns empty array when bundle has no capabilities", async () => {
		const bundle = createBundle([]);

		const result = await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		expect(result.filesWritten).toEqual([]);
	});

	test("creates parent directory if needed", async () => {
		const mcp: McpConfig = {
			command: "node",
			args: ["server.js"],
		};
		const bundle = createBundle([createCapability("test-mcp", mcp)]);

		// .cursor directory doesn't exist yet
		expect(existsSync(`${testDir.path}/.cursor`)).toBe(false);

		await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		expect(existsSync(`${testDir.path}/.cursor`)).toBe(true);
		expect(existsSync(`${testDir.path}/.cursor/mcp.json`)).toBe(true);
	});

	test("regenerates file on re-sync (replaces previous content)", async () => {
		// First sync
		const bundle1 = createBundle([
			createCapability("old-mcp", {
				command: "old-command",
				args: ["old-arg"],
			}),
		]);

		await CursorMcpJsonWriter.write(bundle1, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		const content1 = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");
		expect(content1).toContain("old-mcp");
		expect(content1).toContain("old-command");

		// Second sync with different MCP
		const bundle2 = createBundle([
			createCapability("new-mcp", {
				command: "new-command",
				args: ["new-arg"],
			}),
		]);

		await CursorMcpJsonWriter.write(bundle2, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		const content2 = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");
		// Old content should be gone
		expect(content2).not.toContain("old-mcp");
		expect(content2).not.toContain("old-command");
		// New content should be present
		expect(content2).toContain("new-mcp");
		expect(content2).toContain("new-command");
	});

	test("omits empty args and env", async () => {
		const mcp: McpConfig = {
			command: "simple-server",
			args: [], // Empty array
			env: {}, // Empty object
		};
		const bundle = createBundle([createCapability("simple", mcp)]);

		await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");
		const parsed = JSON.parse(content) as {
			mcpServers: Record<string, Record<string, unknown>>;
		};

		// Should have command but not empty arrays/objects
		expect(parsed.mcpServers["simple"]["command"]).toBe("simple-server");
		expect(parsed.mcpServers["simple"]["args"]).toBeUndefined();
		expect(parsed.mcpServers["simple"]["env"]).toBeUndefined();
	});

	test("outputs valid JSON with trailing newline", async () => {
		const mcp: McpConfig = {
			command: "npx",
			args: ["-y", "mcp-server"],
		};
		const bundle = createBundle([createCapability("test", mcp)]);

		await CursorMcpJsonWriter.write(bundle, {
			outputPath: ".cursor/mcp.json",
			projectRoot: testDir.path,
		});

		const content = readFileSync(`${testDir.path}/.cursor/mcp.json`, "utf-8");

		// Should be valid JSON
		expect(() => JSON.parse(content)).not.toThrow();

		// Should end with newline
		expect(content.endsWith("\n")).toBe(true);
	});
});

describe("buildCursorMcpConfig", () => {
	test("converts stdio transport correctly", () => {
		const mcp: McpConfig = {
			command: "npx",
			args: ["-y", "@playwright/mcp"],
			env: { DEBUG: "true" },
		};

		const result = buildCursorMcpConfig(mcp);

		expect(result).toEqual({
			command: "npx",
			args: ["-y", "@playwright/mcp"],
			env: { DEBUG: "true" },
		});
	});

	test("converts http transport correctly", () => {
		const mcp: McpConfig = {
			transport: "http",
			url: "https://api.example.com/mcp",
			headers: { Authorization: "Bearer token" },
		};

		const result = buildCursorMcpConfig(mcp);

		expect(result).toEqual({
			url: "https://api.example.com/mcp",
			headers: { Authorization: "Bearer token" },
		});
	});

	test("converts sse transport correctly", () => {
		const mcp: McpConfig = {
			transport: "sse",
			url: "https://api.example.com/sse",
			headers: { "X-API-Key": "key" },
		};

		const result = buildCursorMcpConfig(mcp);

		expect(result).toEqual({
			url: "https://api.example.com/sse",
			headers: { "X-API-Key": "key" },
		});
	});

	test("uses stdio as default transport", () => {
		const mcp: McpConfig = {
			command: "server",
			// No transport specified
		};

		const result = buildCursorMcpConfig(mcp);

		expect(result).toEqual({
			command: "server",
		});
	});

	test("returns null for http without url", () => {
		const mcp: McpConfig = {
			transport: "http",
			// No URL
		};

		const result = buildCursorMcpConfig(mcp);

		expect(result).toBeNull();
	});

	test("returns null for stdio without command", () => {
		const mcp: McpConfig = {
			args: ["some-arg"],
			// No command
		};

		const result = buildCursorMcpConfig(mcp);

		expect(result).toBeNull();
	});
});
