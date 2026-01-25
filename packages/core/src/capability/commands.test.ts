import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { loadCommands } from "./commands";

describe("loadCommands", () => {
	const testDir = setupTestDir("capability-commands-test-");
	let capabilityPath: string;

	beforeEach(() => {
		capabilityPath = join(testDir.path, "test-capability");
		mkdirSync(capabilityPath, { recursive: true });
	});

	test("returns empty array when commands directory does not exist", async () => {
		const commands = await loadCommands(capabilityPath, "test-cap");
		expect(commands).toEqual([]);
	});

	test("returns empty array when commands directory is empty", async () => {
		mkdirSync(join(capabilityPath, "commands"), { recursive: true });
		const commands = await loadCommands(capabilityPath, "test-cap");
		expect(commands).toEqual([]);
	});

	test("loads single command with valid frontmatter and prompt", async () => {
		const commandDir = join(capabilityPath, "commands", "test-command");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: test-command
description: A test command
---

Test command prompt with $ARGUMENTS.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]).toEqual({
			name: "test-command",
			description: "A test command",
			prompt: "Test command prompt with $ARGUMENTS.",
			capabilityId: "test-cap",
		});
	});

	test("loads command with allowedTools field", async () => {
		const commandDir = join(capabilityPath, "commands", "tools-command");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: tools-command
description: Command with allowed tools
allowedTools: Bash(git add:*), Bash(git commit:*)
---

Command prompt here.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.allowedTools).toBe("Bash(git add:*), Bash(git commit:*)");
	});

	test("loads command with allowed-tools field (kebab-case)", async () => {
		const commandDir = join(capabilityPath, "commands", "kebab-tools");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: kebab-tools
description: Command with kebab-case allowed-tools
allowed-tools: Bash(npm test:*)
---

Command prompt here.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.allowedTools).toBe("Bash(npm test:*)");
	});

	test("loads multiple commands from different directories", async () => {
		const command1Dir = join(capabilityPath, "commands", "command-1");
		const command2Dir = join(capabilityPath, "commands", "command-2");
		mkdirSync(command1Dir, { recursive: true });
		mkdirSync(command2Dir, { recursive: true });

		writeFileSync(
			join(command1Dir, "COMMAND.md"),
			`---
name: command-1
description: First command
---

First command prompt.`,
		);

		writeFileSync(
			join(command2Dir, "COMMAND.md"),
			`---
name: command-2
description: Second command
---

Second command prompt.`,
		);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(2);
		expect(commands[0]?.name).toBe("command-1");
		expect(commands[1]?.name).toBe("command-2");
	});

	test("skips command directories without COMMAND.md file", async () => {
		const validDir = join(capabilityPath, "commands", "valid-command");
		const invalidDir = join(capabilityPath, "commands", "no-file");
		mkdirSync(validDir, { recursive: true });
		mkdirSync(invalidDir, { recursive: true });

		writeFileSync(
			join(validDir, "COMMAND.md"),
			`---
name: valid-command
description: Valid command
---

Valid prompt.`,
		);

		// No COMMAND.md in invalidDir

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.name).toBe("valid-command");
	});

	test("handles YAML frontmatter with quoted values", async () => {
		const commandDir = join(capabilityPath, "commands", "quoted-command");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: "quoted-command"
description: "A command with quoted values"
---

Command prompt here.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.name).toBe("quoted-command");
		expect(commands[0]?.description).toBe("A command with quoted values");
	});

	test("trims whitespace from prompt", async () => {
		const commandDir = join(capabilityPath, "commands", "whitespace-command");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: whitespace-command
description: Test whitespace trimming
---


Command prompt with leading/trailing whitespace.

	`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.prompt).toBe("Command prompt with leading/trailing whitespace.");
	});

	test("throws error when COMMAND.md has no frontmatter", async () => {
		const commandDir = join(capabilityPath, "commands", "no-frontmatter");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `# Just Instructions

No frontmatter here.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		await expect(loadCommands(capabilityPath, "test-cap")).rejects.toThrow(
			/Invalid COMMAND\.md format.*missing YAML frontmatter/,
		);
	});

	test("throws error when COMMAND.md is missing name field", async () => {
		const commandDir = join(capabilityPath, "commands", "missing-name");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
description: Missing name field
---

Command prompt here.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		await expect(loadCommands(capabilityPath, "test-cap")).rejects.toThrow(
			/name and description required/,
		);
	});

	test("throws error when COMMAND.md is missing description field", async () => {
		const commandDir = join(capabilityPath, "commands", "missing-description");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: missing-description
---

Command prompt here.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		await expect(loadCommands(capabilityPath, "test-cap")).rejects.toThrow(
			/name and description required/,
		);
	});

	test("handles empty prompt after frontmatter", async () => {
		const commandDir = join(capabilityPath, "commands", "empty-prompt");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: empty-prompt
description: Command with no prompt
---
`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.prompt).toBe("");
	});

	test("preserves markdown formatting in prompt", async () => {
		const commandDir = join(capabilityPath, "commands", "markdown-command");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: markdown-command
description: Command with markdown
---

# Header

- List item 1
- List item 2

**Bold text** and *italic text*.

\`\`\`bash
git add .
git commit -m "message"
\`\`\`

Use $ARGUMENTS and $1, $2 for arguments.
Execute bash commands with !\`git status\`.
Reference files with @src/file.js.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.prompt).toContain("# Header");
		expect(commands[0]?.prompt).toContain("- List item 1");
		expect(commands[0]?.prompt).toContain("**Bold text**");
		expect(commands[0]?.prompt).toContain("```bash");
		expect(commands[0]?.prompt).toContain("$ARGUMENTS");
		expect(commands[0]?.prompt).toContain("$1, $2");
		expect(commands[0]?.prompt).toContain("!`git status`");
		expect(commands[0]?.prompt).toContain("@src/file.js");
	});

	test("loads flat files in commands folder", async () => {
		const commandsDir = join(capabilityPath, "commands");
		const validDir = join(commandsDir, "valid-command");
		mkdirSync(validDir, { recursive: true });

		writeFileSync(
			join(validDir, "COMMAND.md"),
			`---
name: valid-command
description: Valid command
---

Valid prompt.`,
		);

		// Create a flat file directly in commands/ directory
		writeFileSync(
			join(commandsDir, "flat-command.md"),
			`---
name: flat-command
description: Flat file command
---

Flat file prompt.`,
		);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(2);
		expect(commands.find((c) => c.name === "valid-command")).toBeDefined();
		expect(commands.find((c) => c.name === "flat-command")).toBeDefined();
	});

	test("associates commands with correct capability ID", async () => {
		const commandDir = join(capabilityPath, "commands", "test-command");
		mkdirSync(commandDir, { recursive: true });

		writeFileSync(
			join(commandDir, "COMMAND.md"),
			`---
name: test-command
description: Test command
---

Command prompt.`,
		);

		const commands = await loadCommands(capabilityPath, "my-capability");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.capabilityId).toBe("my-capability");
	});

	test("handles commands with argument placeholders", async () => {
		const commandDir = join(capabilityPath, "commands", "arg-command");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: arg-command
description: Command with argument placeholders
---

Fix issue #$ARGUMENTS.

Review PR #$1 with priority $2 and assign to $3.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.prompt).toContain("$ARGUMENTS");
		expect(commands[0]?.prompt).toContain("$1");
		expect(commands[0]?.prompt).toContain("$2");
		expect(commands[0]?.prompt).toContain("$3");
	});

	test("handles commands with bash execution syntax", async () => {
		const commandDir = join(capabilityPath, "commands", "bash-command");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: bash-command
description: Command with bash execution
---

Current status: !\`git status\`
Current branch: !\`git branch --show-current\`
Recent commits: !\`git log --oneline -10\``;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.prompt).toContain("!`git status`");
		expect(commands[0]?.prompt).toContain("!`git branch --show-current`");
		expect(commands[0]?.prompt).toContain("!`git log --oneline -10`");
	});

	test("handles commands with file references", async () => {
		const commandDir = join(capabilityPath, "commands", "file-command");
		mkdirSync(commandDir, { recursive: true });

		const commandContent = `---
name: file-command
description: Command with file references
---

Review the implementation in @src/utils/helpers.js.

Compare @src/old-version.js with @src/new-version.js.`;

		writeFileSync(join(commandDir, "COMMAND.md"), commandContent);

		const commands = await loadCommands(capabilityPath, "test-cap");

		expect(commands).toHaveLength(1);
		expect(commands[0]?.prompt).toContain("@src/utils/helpers.js");
		expect(commands[0]?.prompt).toContain("@src/old-version.js");
		expect(commands[0]?.prompt).toContain("@src/new-version.js");
	});
});
