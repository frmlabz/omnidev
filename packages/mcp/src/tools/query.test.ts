import { describe, expect, test } from "bun:test";
import type { CapabilityRegistry, LoadedCapability } from "@omnidev/core";
import { handleOmniQuery } from "./query";

// Mock capability registry for testing
function createMockRegistry(capabilities: LoadedCapability[]): CapabilityRegistry {
	return {
		getAllCapabilities: () => capabilities,
		getAllSkills: () => {
			const skills = [];
			for (const cap of capabilities) {
				skills.push(...cap.skills);
			}
			return skills;
		},
		getAllDocs: () => {
			const docs = [];
			for (const cap of capabilities) {
				docs.push(...cap.docs);
			}
			return docs;
		},
		getAllRules: () => {
			const rules = [];
			for (const cap of capabilities) {
				rules.push(...cap.rules);
			}
			return rules;
		},
		getCapability: (id: string) => capabilities.find((c) => c.id === id),
	};
}

// Mock capability for testing
function createMockCapability(
	id: string,
	description: string,
	typeDefinitions?: string,
	hasTools = false,
): LoadedCapability {
	return {
		id,
		path: `omni/capabilities/${id}`,
		config: {
			capability: {
				id,
				name: id,
				version: "1.0.0",
				description,
			},
		},
		skills: [
			{
				name: `${id}-skill`,
				description: `${id} skill description`,
				instructions: `${id} instructions`,
				capabilityId: id,
			},
		],
		rules: [
			{
				name: `${id}-rule`,
				content: `${id} rule content`,
				capabilityId: id,
			},
		],
		docs: [
			{
				name: "definition",
				content: `${id} documentation content`,
				capabilityId: id,
			},
		],
		typeDefinitions: typeDefinitions || undefined,
		exports: hasTools
			? {
					mcpTools: {
						dummyTool: {
							name: "dummyTool",
							description: "A dummy tool",
						},
					},
				}
			: {},
	};
}

describe("handleOmniQuery", () => {
	test("returns summary when query is empty", async () => {
		const capabilities = [
			createMockCapability("tasks", "Task management capability"),
			createMockCapability("files", "File operations capability"),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, {});

		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");
		const text = result.content[0]?.text || "";
		expect(text).toContain("Enabled capabilities (2):");
		expect(text).toContain("- tasks: Task management capability");
		expect(text).toContain("- files: File operations capability");
	});

	test("includes type definitions when include_types is true and capability has tools", async () => {
		const capabilities = [
			createMockCapability(
				"tasks",
				"Task management capability",
				"export function createTask(): void;",
				true, // hasTools = true
			),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { include_types: true });

		const text = result.content[0]?.text || "";
		expect(text).toContain("--- Type Definitions ---");
		expect(text).toContain("declare module 'tasks'");
		expect(text).toContain("export function createTask(): void;");
	});

	test("excludes type definitions for capabilities without tools", async () => {
		const capabilities = [
			createMockCapability(
				"tasks",
				"Task management capability",
				"export function createTask(): void;",
				false, // hasTools = false (CLI-only capability)
			),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { include_types: true });

		const text = result.content[0]?.text || "";
		expect(text).toContain("--- Type Definitions ---");
		expect(text).toContain("No capabilities with tools are currently enabled");
		expect(text).not.toContain("declare module 'tasks'");
	});

	test("searches capabilities by id", async () => {
		const capabilities = [
			createMockCapability("tasks", "Task management capability"),
			createMockCapability("files", "File operations capability"),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "tasks" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("[capability:tasks]");
		expect(text).toContain("Task management capability");
		expect(text).not.toContain("[capability:files]");
	});

	test("searches capabilities by description", async () => {
		const capabilities = [
			createMockCapability("tasks", "Task management capability"),
			createMockCapability("files", "File operations capability"),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "operations" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("[capability:files]");
		expect(text).toContain("File operations capability");
		expect(text).not.toContain("[capability:tasks]");
	});

	test("searches skills by name", async () => {
		const capabilities = [createMockCapability("tasks", "Task management capability")];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "tasks-skill" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("[skill:tasks/tasks-skill]");
		expect(text).toContain("tasks skill description");
	});

	test("searches skills by description", async () => {
		const capabilities = [createMockCapability("tasks", "Task management capability")];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "skill description" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("[skill:tasks/tasks-skill]");
	});

	test("searches docs by name", async () => {
		const capabilities = [createMockCapability("tasks", "Task management capability")];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "definition" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("[doc:tasks/definition]");
	});

	test("searches docs by content", async () => {
		const capabilities = [createMockCapability("tasks", "Task management capability")];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "documentation" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("[doc:tasks/definition]");
		expect(text).toContain("tasks documentation content...");
	});

	test("limits results to specified limit", async () => {
		const capabilities = [
			createMockCapability("tasks", "Task management capability"),
			createMockCapability("files", "File operations capability"),
			createMockCapability("git", "Git operations capability"),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "capability", limit: 2 });

		const text = result.content[0]?.text || "";
		const lines = text.split("\n").filter((line) => line.startsWith("["));
		expect(lines.length).toBe(2);
	});

	test("includes type definitions when include_types is true", async () => {
		const capabilities = [
			createMockCapability(
				"tasks",
				"Task management capability",
				"export function createTask(): void;",
				true, // hasTools = true
			),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "tasks", include_types: true });

		const text = result.content[0]?.text || "";
		expect(text).toContain("--- Type Definitions ---");
		expect(text).toContain("declare module 'tasks'");
	});

	test("does not include type definitions when include_types is false", async () => {
		const capabilities = [
			createMockCapability(
				"tasks",
				"Task management capability",
				"export function createTask(): void;",
				true, // hasTools = true
			),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "tasks", include_types: false });

		const text = result.content[0]?.text || "";
		expect(text).not.toContain("--- Type Definitions ---");
	});

	test("handles capability with custom exports module name", async () => {
		const cap = createMockCapability(
			"tasks",
			"Task management capability",
			"export function createTask(): void;",
			true, // hasTools = true
		);
		cap.config.exports = { module: "custom-tasks" };
		const registry = createMockRegistry([cap]);

		const result = await handleOmniQuery(registry, { include_types: true });

		const text = result.content[0]?.text || "";
		expect(text).toContain("declare module 'custom-tasks'");
	});

	test("handles capability with no type definitions", async () => {
		const capabilities = [
			createMockCapability("tasks", "Task management capability", undefined, true),
		];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { include_types: true });

		const text = result.content[0]?.text || "";
		expect(text).toContain("// No type definitions available");
	});

	test("handles empty registry", async () => {
		const registry = createMockRegistry([]);

		const result = await handleOmniQuery(registry, {});

		const text = result.content[0]?.text || "";
		expect(text).toContain("Enabled capabilities (0):");
	});

	test("handles no matching results", async () => {
		const registry = createMockRegistry([]);

		const result = await handleOmniQuery(registry, { query: "nonexistent" });

		const text = result.content[0]?.text || "";
		expect(text).toBe("");
	});

	test("handles case-insensitive search", async () => {
		const capabilities = [createMockCapability("tasks", "Task Management Capability")];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "TASK" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("[capability:tasks]");
	});

	test("truncates long doc content to 100 characters", async () => {
		const cap = createMockCapability("tasks", "Task management capability");
		cap.docs[0] = {
			name: "definition",
			content: "a".repeat(200),
			capabilityId: "tasks",
		};
		const registry = createMockRegistry([cap]);

		const result = await handleOmniQuery(registry, { query: "definition" });

		const text = result.content[0]?.text || "";
		const match = text.match(/\[doc:tasks\/definition\] (.+?)\.\.\.$/m);
		expect(match).toBeTruthy();
		const snippet = match?.[1] || "";
		expect(snippet.length).toBeLessThanOrEqual(100);
	});

	test("replaces newlines in doc snippets with spaces", async () => {
		const cap = createMockCapability("tasks", "Task management capability");
		cap.docs[0] = {
			name: "definition",
			content: "line1\nline2\nline3",
			capabilityId: "tasks",
		};
		const registry = createMockRegistry([cap]);

		const result = await handleOmniQuery(registry, { query: "definition" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("line1 line2 line3");
		expect(text).not.toContain("\n\n"); // No double newlines from content
	});

	test("handles default limit of 10", async () => {
		// Create 15 capabilities
		const capabilities = Array.from({ length: 15 }, (_, i) =>
			createMockCapability(`cap${i}`, `Capability ${i}`),
		);
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "capability" });

		const text = result.content[0]?.text || "";
		const lines = text.split("\n").filter((line) => line.startsWith("["));
		expect(lines.length).toBeLessThanOrEqual(10);
	});

	test("handles undefined args object", async () => {
		const capabilities = [createMockCapability("tasks", "Task management capability")];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, undefined);

		const text = result.content[0]?.text || "";
		expect(text).toContain("Enabled capabilities (1):");
	});

	test("returns multiple matching results of different types", async () => {
		const capabilities = [createMockCapability("tasks", "Task management capability")];
		const registry = createMockRegistry(capabilities);

		const result = await handleOmniQuery(registry, { query: "tasks" });

		const text = result.content[0]?.text || "";
		expect(text).toContain("[capability:tasks]");
		expect(text).toContain("[skill:tasks/tasks-skill]");
		expect(text).toContain("[doc:tasks/definition]");
	});
});
