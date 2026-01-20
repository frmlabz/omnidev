import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "../test-utils/index.js";
import { patchAddCapabilitySource, patchAddMcp, patchAddToProfile } from "./toml-patcher";

describe("toml-patcher", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = tmpdir("toml-patcher-");
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("patchAddCapabilitySource", () => {
		test("adds capability source to existing section", async () => {
			writeFileSync(
				"omni.toml",
				`# My custom comment
[capabilities.sources]
existing = "github:org/existing"
`,
			);

			await patchAddCapabilitySource("new-cap", "github:org/new-cap");

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("# My custom comment");
			expect(content).toContain('existing = "github:org/existing"');
			expect(content).toContain('new-cap = "github:org/new-cap"');
		});

		test("adds capability source with path option", async () => {
			writeFileSync(
				"omni.toml",
				`[capabilities.sources]
`,
			);

			await patchAddCapabilitySource("my-cap", { source: "github:org/repo", path: "subfolder" });

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain('my-cap = { source = "github:org/repo", path = "subfolder" }');
		});

		test("creates capabilities.sources section if missing", async () => {
			writeFileSync(
				"omni.toml",
				`# My project config
[profiles.default]
capabilities = []
`,
			);

			await patchAddCapabilitySource("my-cap", "github:org/my-cap");

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("# My project config");
			expect(content).toContain("[capabilities.sources]");
			expect(content).toContain('my-cap = "github:org/my-cap"');
		});

		test("preserves all existing comments", async () => {
			writeFileSync(
				"omni.toml",
				`# File header comment
# Another header line

# Section comment
[capabilities.sources]
# Inline source comment
existing = "github:org/existing"

# End of section comment
`,
			);

			await patchAddCapabilitySource("new-cap", "github:org/new");

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("# File header comment");
			expect(content).toContain("# Another header line");
			expect(content).toContain("# Section comment");
			expect(content).toContain("# Inline source comment");
			expect(content).toContain("# End of section comment");
		});
	});

	describe("patchAddMcp", () => {
		test("adds MCP to existing mcps section", async () => {
			writeFileSync(
				"omni.toml",
				`# Custom comment
[mcps.existing]
command = "npx"
`,
			);

			await patchAddMcp("new-mcp", {
				command: "node",
				args: ["server.js"],
			});

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("# Custom comment");
			expect(content).toContain("[mcps.existing]");
			expect(content).toContain("[mcps.new-mcp]");
			expect(content).toContain('command = "node"');
			expect(content).toContain('args = ["server.js"]');
		});

		test("adds HTTP MCP with headers", async () => {
			writeFileSync("omni.toml", "");

			await patchAddMcp("api-server", {
				transport: "http",
				url: "https://api.example.com/mcp",
				headers: {
					Authorization: "Bearer token123",
				},
			});

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("[mcps.api-server]");
			expect(content).toContain('transport = "http"');
			expect(content).toContain('url = "https://api.example.com/mcp"');
			expect(content).toContain("[mcps.api-server.headers]");
			expect(content).toContain('Authorization = "Bearer token123"');
		});

		test("adds MCP with environment variables", async () => {
			writeFileSync("omni.toml", "");

			await patchAddMcp("db-server", {
				command: "node",
				args: ["db.js"],
				env: {
					DATABASE_URL: "postgres://localhost",
				},
			});

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("[mcps.db-server]");
			expect(content).toContain('env = { DATABASE_URL = "postgres://localhost" }');
		});

		test("preserves comments when adding MCP", async () => {
			writeFileSync(
				"omni.toml",
				`# My important file comment

# MCP section comment
[mcps.existing]
command = "test"
`,
			);

			await patchAddMcp("new", { command: "new-cmd" });

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("# My important file comment");
			expect(content).toContain("# MCP section comment");
		});
	});

	describe("patchAddToProfile", () => {
		test("adds capability to existing profile", async () => {
			writeFileSync(
				"omni.toml",
				`# Config header
[profiles.default]
capabilities = ["existing"]
`,
			);

			await patchAddToProfile("default", "new-cap");

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("# Config header");
			expect(content).toContain('capabilities = ["existing", "new-cap"]');
		});

		test("creates profile if it does not exist", async () => {
			writeFileSync(
				"omni.toml",
				`# Header
[profiles.default]
capabilities = ["test"]
`,
			);

			await patchAddToProfile("development", "my-cap");

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("# Header");
			expect(content).toContain("[profiles.development]");
			expect(content).toContain('capabilities = ["my-cap"]');
		});

		test("adds capabilities line if missing in profile", async () => {
			writeFileSync(
				"omni.toml",
				`[profiles.minimal]
`,
			);

			await patchAddToProfile("minimal", "new-cap");

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("[profiles.minimal]");
			expect(content).toContain('capabilities = ["new-cap"]');
		});

		test("does not duplicate existing capability", async () => {
			writeFileSync(
				"omni.toml",
				`[profiles.default]
capabilities = ["existing"]
`,
			);

			await patchAddToProfile("default", "existing");

			const content = await readFile("omni.toml", "utf-8");
			// Should only have one occurrence
			const matches = content.match(/"existing"/g);
			expect(matches?.length).toBe(1);
		});

		test("preserves comments when modifying profile", async () => {
			writeFileSync(
				"omni.toml",
				`# Important project header
# More info about the project

# Profile section comment
[profiles.default]
# List of capabilities for this profile
capabilities = ["base"]

# Another section
[something.else]
value = true
`,
			);

			await patchAddToProfile("default", "new-cap");

			const content = await readFile("omni.toml", "utf-8");
			expect(content).toContain("# Important project header");
			expect(content).toContain("# More info about the project");
			expect(content).toContain("# Profile section comment");
			expect(content).toContain("# List of capabilities for this profile");
			expect(content).toContain("# Another section");
		});
	});

	describe("integration scenarios", () => {
		test("complex file with multiple sections and comments", async () => {
			writeFileSync(
				"omni.toml",
				`# =============================================================================
# =============================================================================

# Capability Sources
# These are fetched from GitHub
[capabilities.sources]
tasks = "github:company/tasks"
# Commented out source below
# old-cap = "github:company/old"

# MCP Servers for tools
[mcps.filesystem]
command = "npx"
args = ["-y", "@mcp/filesystem"]

# Profile definitions
# Use these for different workflows

[profiles.default]
capabilities = ["tasks"]

[profiles.dev]
# Development profile with extra tools
capabilities = ["tasks", "debug"]
`,
			);

			// Add new capability
			await patchAddCapabilitySource("new-tasks", "github:company/new-tasks");
			// Add new MCP
			await patchAddMcp("database", { command: "node", args: ["db.js"] });
			// Add to default profile
			await patchAddToProfile("default", "new-tasks");
			// Add to dev profile
			await patchAddToProfile("dev", "database");

			const content = await readFile("omni.toml", "utf-8");

			// All original comments should be preserved
			expect(content).toContain(
				"# =============================================================================",
			);
			expect(content).toContain("# These are fetched from GitHub");
			expect(content).toContain("# Commented out source below");
			expect(content).toContain("# old-cap");
			expect(content).toContain("# MCP Servers for tools");
			expect(content).toContain("# Profile definitions");
			expect(content).toContain("# Use these for different workflows");
			expect(content).toContain("# Development profile with extra tools");

			// New entries should be present
			expect(content).toContain('new-tasks = "github:company/new-tasks"');
			expect(content).toContain("[mcps.database]");
			expect(content).toContain('capabilities = ["tasks", "new-tasks"]');
			expect(content).toContain('capabilities = ["tasks", "debug", "database"]');
		});

		test("empty file creates proper structure", async () => {
			writeFileSync("omni.toml", "");

			await patchAddCapabilitySource("my-cap", "github:org/cap");
			await patchAddMcp("my-mcp", { command: "test" });
			await patchAddToProfile("default", "my-cap");

			const content = await readFile("omni.toml", "utf-8");

			expect(content).toContain("[capabilities.sources]");
			expect(content).toContain('my-cap = "github:org/cap"');
			expect(content).toContain("[mcps.my-mcp]");
			expect(content).toContain("[profiles.default]");
		});
	});
});
