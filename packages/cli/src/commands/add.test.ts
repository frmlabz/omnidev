import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { runAddCap, runAddMcp } from "./add";

describe("add commands", () => {
	setupTestDir("add-test-", { chdir: true });
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;
	let consoleOutput: string[];
	let consoleErrors: string[];
	let originalLog: typeof console.log;
	let originalError: typeof console.error;

	beforeEach(() => {
		// Mock process.exit
		exitCode = undefined;
		originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCode = code ?? 0;
			throw new Error(`process.exit(${code})`);
		}) as typeof process.exit;

		// Mock console
		consoleOutput = [];
		consoleErrors = [];
		originalLog = console.log;
		originalError = console.error;
		console.log = (...args: unknown[]) => {
			consoleOutput.push(args.join(" "));
		};
		console.error = (...args: unknown[]) => {
			consoleErrors.push(args.join(" "));
		};
	});

	afterEach(() => {
		process.exit = originalExit;
		console.log = originalLog;
		console.error = originalError;
	});

	describe("runAddCap", () => {
		test("should show error when config file does not exist", async () => {
			try {
				await runAddCap({ github: "user/repo" }, "test-cap");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleOutput.join("\n")).toContain("No config file found");
			expect(consoleOutput.join("\n")).toContain("Run: omnidev init");
		});

		test("should show error for invalid github format", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			try {
				await runAddCap({ github: "invalid" }, "test-cap");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Invalid GitHub repository format");
		});

		test("should add capability source from GitHub", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddCap({ github: "expo/skills" }, "expo-design");

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[capabilities.sources]");
			expect(configContent).toContain('expo-design = "github:expo/skills"');
			expect(configContent).toContain('capabilities = ["expo-design"]');

			const output = consoleOutput.join("\n");
			expect(output).toContain("Added capability source: expo-design");
			expect(output).toContain("Source: github:expo/skills");
		});

		test("should add capability source with path parameter", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddCap({ github: "expo/skills", path: "plugins/expo-app-design" }, "expo-design");

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[capabilities.sources]");
			expect(configContent).toContain(
				'expo-design = { source = "github:expo/skills", path = "plugins/expo-app-design" }',
			);

			const output = consoleOutput.join("\n");
			expect(output).toContain("Path: plugins/expo-app-design");
		});

		test("should show error when capability source already exists", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[capabilities.sources]
expo-design = "github:expo/skills"

[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			try {
				await runAddCap({ github: "expo/skills" }, "expo-design");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain('Capability source "expo-design" already exists');
		});

		test("should auto-enable capability in active profile", async () => {
			mkdirSync(".omni/state", { recursive: true });
			await writeFile(".omni/state/active-profile", "planning", "utf-8");
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.planning]
capabilities = ["existing-cap"]
`,
				"utf-8",
			);

			await runAddCap({ github: "expo/skills" }, "expo-design");

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain('capabilities = ["existing-cap", "expo-design"]');

			const output = consoleOutput.join("\n");
			expect(output).toContain("Enabled in profile: planning");
		});

		test("should add capability source from local path", async () => {
			mkdirSync(".omni", { recursive: true });
			mkdirSync("capabilities/my-local-cap", { recursive: true });
			await writeFile(
				"capabilities/my-local-cap/capability.toml",
				`[capability]
id = "my-local-cap"
name = "My Local Cap"
version = "1.0.0"
description = "Test local capability"
`,
				"utf-8",
			);
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddCap({ local: "./capabilities/my-local-cap" }, "my-local-cap");

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[capabilities.sources]");
			expect(configContent).toContain('my-local-cap = "file://./capabilities/my-local-cap"');
			expect(configContent).toContain('capabilities = ["my-local-cap"]');

			const output = consoleOutput.join("\n");
			expect(output).toContain("Added capability source: my-local-cap");
			expect(output).toContain("Source: file://./capabilities/my-local-cap");
		});

		test("should infer capability ID from capability.toml for local source", async () => {
			mkdirSync(".omni", { recursive: true });
			mkdirSync("caps/test-cap", { recursive: true });
			await writeFile(
				"caps/test-cap/capability.toml",
				`[capability]
id = "inferred-id"
name = "Inferred Capability"
version = "1.0.0"
description = "Test"
`,
				"utf-8",
			);
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			// Don't pass name, it should be inferred
			await runAddCap({ local: "./caps/test-cap" });

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain('inferred-id = "file://./caps/test-cap"');

			const output = consoleOutput.join("\n");
			expect(output).toContain("Inferred capability ID: inferred-id");
		});

		test("should infer capability ID from directory name when no capability.toml", async () => {
			mkdirSync(".omni", { recursive: true });
			mkdirSync("caps/my-dir-cap", { recursive: true });
			// Create a minimal capability.toml without id
			await writeFile(
				"caps/my-dir-cap/capability.toml",
				`[capability]
name = "My Cap"
version = "1.0.0"
description = "Test"
`,
				"utf-8",
			);
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddCap({ local: "./caps/my-dir-cap" });

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain('my-dir-cap = "file://./caps/my-dir-cap"');
		});

		test("should infer capability ID from github repo name", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddCap({ github: "expo/skills" });

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain('skills = "github:expo/skills"');

			const output = consoleOutput.join("\n");
			expect(output).toContain("Inferred capability ID: skills");
		});

		test("should infer capability ID from path when --path is provided", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddCap({ github: "expo/skills", path: "plugins/expo-app-design" });

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain(
				'expo-app-design = { source = "github:expo/skills", path = "plugins/expo-app-design" }',
			);

			const output = consoleOutput.join("\n");
			expect(output).toContain("Inferred capability ID: expo-app-design");
		});

		test("should infer capability ID from single-segment path", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddCap({ github: "user/capabilities-repo", path: "my-cap" });

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain(
				'my-cap = { source = "github:user/capabilities-repo", path = "my-cap" }',
			);

			const output = consoleOutput.join("\n");
			expect(output).toContain("Inferred capability ID: my-cap");
		});

		test("should show error when neither --github nor --local is provided", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			try {
				await runAddCap({});
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("No source specified");
		});

		test("should show error when both --github and --local are provided", async () => {
			mkdirSync(".omni", { recursive: true });
			mkdirSync("caps/test", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			try {
				await runAddCap({ github: "user/repo", local: "./caps/test" });
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Cannot specify both --github and --local");
		});

		test("should show error when local path does not exist", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			try {
				await runAddCap({ local: "./nonexistent/path" });
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Local path not found");
		});
	});

	describe("runAddMcp", () => {
		test("should show error when config file does not exist", async () => {
			try {
				await runAddMcp({ command: "npx" }, "filesystem");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleOutput.join("\n")).toContain("No config file found");
		});

		test("should add MCP with HTTP transport", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddMcp({ transport: "http", url: "https://mcp.notion.com/mcp" }, "notion");

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[mcps.notion]");
			expect(configContent).toContain('transport = "http"');
			expect(configContent).toContain('url = "https://mcp.notion.com/mcp"');
			expect(configContent).toContain('capabilities = ["notion"]');

			const output = consoleOutput.join("\n");
			expect(output).toContain("Added MCP: notion");
			expect(output).toContain("Transport: http");
			expect(output).toContain("URL: https://mcp.notion.com/mcp");
		});

		test("should add MCP with HTTP transport and headers", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddMcp(
				{
					transport: "http",
					url: "https://api.example.com/mcp",
					header: ["Authorization: Bearer token123"],
				},
				"secure-api",
			);

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[mcps.secure-api]");
			expect(configContent).toContain("[mcps.secure-api.headers]");
			expect(configContent).toContain('Authorization = "Bearer token123"');
		});

		test("should add MCP with stdio transport", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddMcp(
				{
					command: "npx",
					args: "-y @modelcontextprotocol/server-filesystem /tmp",
				},
				"filesystem",
			);

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[mcps.filesystem]");
			expect(configContent).toContain('command = "npx"');
			expect(configContent).toContain(
				'args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]',
			);

			const output = consoleOutput.join("\n");
			expect(output).toContain("Added MCP: filesystem");
			expect(output).toContain("Command: npx");
		});

		test("should add MCP with env variables", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			await runAddMcp(
				{
					command: "node",
					args: "./servers/db.js",
					env: ["DB_URL=postgres://localhost"],
				},
				"database",
			);

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[mcps.database]");
			expect(configContent).toContain('env = { DB_URL = "postgres://localhost" }');
		});

		test("should show error when MCP already exists", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[mcps.filesystem]
command = "npx"

[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			try {
				await runAddMcp({ command: "npx" }, "filesystem");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain('MCP "filesystem" already exists');
		});

		test("should show error when URL is missing for http transport", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			try {
				await runAddMcp({ transport: "http" }, "notion");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("--url is required for http/sse transport");
		});

		test("should show error when command is missing for stdio transport", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []
`,
				"utf-8",
			);

			try {
				await runAddMcp({}, "filesystem");
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("--command is required for stdio transport");
		});

		test("should auto-enable MCP in active profile", async () => {
			mkdirSync(".omni/state", { recursive: true });
			await writeFile(".omni/state/active-profile", "dev", "utf-8");
			await writeFile(
				"omni.toml",
				`[profiles.default]
capabilities = []

[profiles.dev]
capabilities = ["some-cap"]
`,
				"utf-8",
			);

			await runAddMcp({ transport: "http", url: "https://mcp.notion.com/mcp" }, "notion");

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[profiles.dev]");
			expect(configContent).toContain('capabilities = ["some-cap", "notion"]');

			const output = consoleOutput.join("\n");
			expect(output).toContain("Enabled in profile: dev");
		});
	});

	describe("writeConfig preserves data", () => {
		test("should preserve existing sources when adding new ones", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[capabilities.sources]
existing = "github:user/existing-repo"

[profiles.default]
capabilities = ["existing"]
`,
				"utf-8",
			);

			await runAddCap({ github: "user/new-repo" }, "new-cap");

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[capabilities.sources]");
			expect(configContent).toContain('existing = "github:user/existing-repo"');
			expect(configContent).toContain('new-cap = "github:user/new-repo"');
		});

		test("should preserve existing MCPs when adding new ones", async () => {
			mkdirSync(".omni", { recursive: true });
			await writeFile(
				"omni.toml",
				`[mcps.existing]
command = "npx"
args = ["-y", "existing-mcp"]

[profiles.default]
capabilities = ["existing"]
`,
				"utf-8",
			);

			await runAddMcp({ transport: "http", url: "https://new-mcp.example.com" }, "new-mcp");

			expect(exitCode).toBeUndefined();

			const configContent = await readFile("omni.toml", "utf-8");
			expect(configContent).toContain("[mcps.existing]");
			expect(configContent).toContain('command = "npx"');
			expect(configContent).toContain("[mcps.new-mcp]");
			expect(configContent).toContain('url = "https://new-mcp.example.com"');
		});
	});
});
