import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { loadSubagents } from "./subagents";

describe("loadSubagents", () => {
	const testDir = setupTestDir("capability-subagents-test-");
	let capabilityPath: string;

	beforeEach(() => {
		capabilityPath = join(testDir.path, "test-capability");
		mkdirSync(capabilityPath, { recursive: true });
	});

	test("returns empty array when subagents directory does not exist", async () => {
		const subagents = await loadSubagents(capabilityPath, "test-cap");
		expect(subagents).toEqual([]);
	});

	test("returns empty array when subagents directory is empty", async () => {
		mkdirSync(join(capabilityPath, "subagents"), { recursive: true });
		const subagents = await loadSubagents(capabilityPath, "test-cap");
		expect(subagents).toEqual([]);
	});

	test("loads single subagent with valid frontmatter and system prompt", async () => {
		const subagentDir = join(capabilityPath, "subagents", "test-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: test-subagent
description: A test subagent
---

You are a test subagent.

## Instructions

Do testing things.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]).toEqual({
			name: "test-subagent",
			description: "A test subagent",
			systemPrompt: "You are a test subagent.\n\n## Instructions\n\nDo testing things.",
			capabilityId: "test-cap",
		});
	});

	test("loads subagent with tools field", async () => {
		const subagentDir = join(capabilityPath, "subagents", "tools-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: tools-subagent
description: Subagent with tools
tools: Read, Glob, Grep
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.tools).toEqual(["Read", "Glob", "Grep"]);
	});

	test("loads subagent with disallowedTools field", async () => {
		const subagentDir = join(capabilityPath, "subagents", "disallowed-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: disallowed-subagent
description: Subagent with disallowed tools
disallowedTools: Write, Edit
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.disallowedTools).toEqual(["Write", "Edit"]);
	});

	test("loads subagent with model field", async () => {
		const subagentDir = join(capabilityPath, "subagents", "model-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: model-subagent
description: Subagent with model
model: haiku
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.model).toBe("haiku");
	});

	test("loads subagent with permissionMode field", async () => {
		const subagentDir = join(capabilityPath, "subagents", "permission-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: permission-subagent
description: Subagent with permission mode
permissionMode: dontAsk
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.permissionMode).toBe("dontAsk");
	});

	test("loads subagent with skills field", async () => {
		const subagentDir = join(capabilityPath, "subagents", "skills-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: skills-subagent
description: Subagent with skills
skills: prd, ralph
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.skills).toEqual(["prd", "ralph"]);
	});

	test("loads subagent with all optional fields", async () => {
		const subagentDir = join(capabilityPath, "subagents", "full-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: full-subagent
description: Subagent with all fields
tools: Read, Glob, Grep, Bash
disallowedTools: Write, Edit
model: sonnet
permissionMode: acceptEdits
skills: prd, ralph, capability-builder
---

You are a fully configured subagent.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.name).toBe("full-subagent");
		expect(subagents[0]?.description).toBe("Subagent with all fields");
		expect(subagents[0]?.tools).toEqual(["Read", "Glob", "Grep", "Bash"]);
		expect(subagents[0]?.disallowedTools).toEqual(["Write", "Edit"]);
		expect(subagents[0]?.model).toBe("sonnet");
		expect(subagents[0]?.permissionMode).toBe("acceptEdits");
		expect(subagents[0]?.skills).toEqual(["prd", "ralph", "capability-builder"]);
		expect(subagents[0]?.systemPrompt).toBe("You are a fully configured subagent.");
	});

	test("loads multiple subagents from different directories", async () => {
		const subagent1Dir = join(capabilityPath, "subagents", "subagent-1");
		const subagent2Dir = join(capabilityPath, "subagents", "subagent-2");
		mkdirSync(subagent1Dir, { recursive: true });
		mkdirSync(subagent2Dir, { recursive: true });

		writeFileSync(
			join(subagent1Dir, "SUBAGENT.md"),
			`---
name: subagent-1
description: First subagent
---

First subagent prompt.`,
		);

		writeFileSync(
			join(subagent2Dir, "SUBAGENT.md"),
			`---
name: subagent-2
description: Second subagent
---

Second subagent prompt.`,
		);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(2);
		expect(subagents[0]?.name).toBe("subagent-1");
		expect(subagents[1]?.name).toBe("subagent-2");
	});

	test("skips subagent directories without SUBAGENT.md file", async () => {
		const validDir = join(capabilityPath, "subagents", "valid-subagent");
		const invalidDir = join(capabilityPath, "subagents", "no-file");
		mkdirSync(validDir, { recursive: true });
		mkdirSync(invalidDir, { recursive: true });

		writeFileSync(
			join(validDir, "SUBAGENT.md"),
			`---
name: valid-subagent
description: Valid subagent
---

Valid prompt.`,
		);

		// No SUBAGENT.md in invalidDir

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.name).toBe("valid-subagent");
	});

	test("handles YAML frontmatter with quoted values", async () => {
		const subagentDir = join(capabilityPath, "subagents", "quoted-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: "quoted-subagent"
description: "A subagent with quoted values"
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.name).toBe("quoted-subagent");
		expect(subagents[0]?.description).toBe("A subagent with quoted values");
	});

	test("trims whitespace from system prompt", async () => {
		const subagentDir = join(capabilityPath, "subagents", "whitespace-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: whitespace-subagent
description: Test whitespace trimming
---


System prompt with leading/trailing whitespace.

	`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.systemPrompt).toBe("System prompt with leading/trailing whitespace.");
	});

	test("throws error when SUBAGENT.md has no frontmatter", async () => {
		const subagentDir = join(capabilityPath, "subagents", "no-frontmatter");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `# Just Instructions

No frontmatter here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		await expect(loadSubagents(capabilityPath, "test-cap")).rejects.toThrow(
			/Invalid SUBAGENT\.md format.*missing YAML frontmatter/,
		);
	});

	test("throws error when SUBAGENT.md is missing name field", async () => {
		const subagentDir = join(capabilityPath, "subagents", "missing-name");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
description: Missing name field
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		await expect(loadSubagents(capabilityPath, "test-cap")).rejects.toThrow(
			/name and description required/,
		);
	});

	test("throws error when SUBAGENT.md is missing description field", async () => {
		const subagentDir = join(capabilityPath, "subagents", "missing-description");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: missing-description
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		await expect(loadSubagents(capabilityPath, "test-cap")).rejects.toThrow(
			/name and description required/,
		);
	});

	test("handles empty system prompt after frontmatter", async () => {
		const subagentDir = join(capabilityPath, "subagents", "empty-prompt");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: empty-prompt
description: Subagent with no prompt
---
`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.systemPrompt).toBe("");
	});

	test("preserves markdown formatting in system prompt", async () => {
		const subagentDir = join(capabilityPath, "subagents", "markdown-subagent");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: markdown-subagent
description: Subagent with markdown
---

# Header

- List item 1
- List item 2

**Bold text** and *italic text*.

\`\`\`typescript
const code = "example";
\`\`\``;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.systemPrompt).toContain("# Header");
		expect(subagents[0]?.systemPrompt).toContain("- List item 1");
		expect(subagents[0]?.systemPrompt).toContain("**Bold text**");
		expect(subagents[0]?.systemPrompt).toContain("```typescript");
	});

	test("loads flat files in subagents folder", async () => {
		const subagentsDir = join(capabilityPath, "subagents");
		const validDir = join(subagentsDir, "valid-subagent");
		mkdirSync(validDir, { recursive: true });

		writeFileSync(
			join(validDir, "SUBAGENT.md"),
			`---
name: valid-subagent
description: Valid subagent
---

Valid prompt.`,
		);

		// Create a flat file directly in subagents/ directory
		writeFileSync(
			join(subagentsDir, "flat-subagent.md"),
			`---
name: flat-subagent
description: Flat file subagent
---

Flat file prompt.`,
		);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(2);
		expect(subagents.find((s) => s.name === "valid-subagent")).toBeDefined();
		expect(subagents.find((s) => s.name === "flat-subagent")).toBeDefined();
	});

	test("associates subagents with correct capability ID", async () => {
		const subagentDir = join(capabilityPath, "subagents", "test-subagent");
		mkdirSync(subagentDir, { recursive: true });

		writeFileSync(
			join(subagentDir, "SUBAGENT.md"),
			`---
name: test-subagent
description: Test subagent
---

System prompt.`,
		);

		const subagents = await loadSubagents(capabilityPath, "my-capability");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.capabilityId).toBe("my-capability");
	});

	test("model field accepts inherit value", async () => {
		const subagentDir = join(capabilityPath, "subagents", "inherit-model");
		mkdirSync(subagentDir, { recursive: true });

		const subagentContent = `---
name: inherit-model
description: Subagent with inherit model
model: inherit
---

System prompt here.`;

		writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

		const subagents = await loadSubagents(capabilityPath, "test-cap");

		expect(subagents).toHaveLength(1);
		expect(subagents[0]?.model).toBe("inherit");
	});

	test("permissionMode field accepts all valid values", async () => {
		const modes = ["default", "acceptEdits", "dontAsk", "bypassPermissions", "plan"] as const;

		for (const mode of modes) {
			// Clean up from previous iteration
			const subagentsDir = join(capabilityPath, "subagents");
			rmSync(subagentsDir, { recursive: true, force: true });

			const subagentDir = join(capabilityPath, "subagents", `${mode}-subagent`);
			mkdirSync(subagentDir, { recursive: true });

			const subagentContent = `---
name: ${mode}-subagent
description: Subagent with ${mode} permission mode
permissionMode: ${mode}
---

System prompt here.`;

			writeFileSync(join(subagentDir, "SUBAGENT.md"), subagentContent);

			const subagents = await loadSubagents(capabilityPath, "test-cap");

			expect(subagents).toHaveLength(1);
			expect(subagents[0]?.permissionMode).toBe(mode);
		}
	});
});
