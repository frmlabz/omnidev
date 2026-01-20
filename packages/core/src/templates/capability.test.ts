import { describe, expect, test } from "bun:test";
import {
	generateCapabilityToml,
	generateHooksTemplate,
	generateHookScript,
	generateRuleTemplate,
	generateSkillTemplate,
} from "./capability.js";

describe("generateCapabilityToml", () => {
	test("generates valid TOML with required fields", () => {
		const result = generateCapabilityToml({
			id: "my-capability",
			name: "My Capability",
		});

		expect(result).toContain("[capability]");
		expect(result).toContain('id = "my-capability"');
		expect(result).toContain('name = "My Capability"');
		expect(result).toContain('version = "0.1.0"');
	});

	test("includes provided description", () => {
		const result = generateCapabilityToml({
			id: "test-cap",
			name: "Test Cap",
			description: "A test capability for testing",
		});

		expect(result).toContain('description = "A test capability for testing"');
	});

	test("uses default description placeholder when not provided", () => {
		const result = generateCapabilityToml({
			id: "test-cap",
			name: "Test Cap",
		});

		expect(result).toContain('description = "TODO: Add a description');
	});

	test("includes commented author and metadata sections", () => {
		const result = generateCapabilityToml({
			id: "test-cap",
			name: "Test Cap",
		});

		expect(result).toContain("# [capability.author]");
		expect(result).toContain("# [capability.metadata]");
		expect(result).toContain("# license = ");
	});
});

describe("generateSkillTemplate", () => {
	test("generates valid YAML frontmatter", () => {
		const result = generateSkillTemplate("my-skill");

		expect(result).toContain("---");
		expect(result).toContain("name: my-skill");
		expect(result).toContain("description:");
	});

	test("includes standard skill sections", () => {
		const result = generateSkillTemplate("test-skill");

		expect(result).toContain("## What I do");
		expect(result).toContain("## When to use me");
		expect(result).toContain("## Implementation");
		expect(result).toContain("## Examples");
	});

	test("includes implementation steps subsection", () => {
		const result = generateSkillTemplate("test-skill");

		expect(result).toContain("### Steps");
	});
});

describe("generateRuleTemplate", () => {
	test("generates markdown with title from kebab-case", () => {
		const result = generateRuleTemplate("coding-standards");

		expect(result).toContain("# Coding Standards");
	});

	test("converts single word to title case", () => {
		const result = generateRuleTemplate("conventions");

		expect(result).toContain("# Conventions");
	});

	test("includes standard rule sections", () => {
		const result = generateRuleTemplate("test-rule");

		expect(result).toContain("## Overview");
		expect(result).toContain("## Guidelines");
		expect(result).toContain("## Examples");
		expect(result).toContain("### Good");
		expect(result).toContain("### Bad");
	});
});

describe("generateHooksTemplate", () => {
	test("generates TOML with commented examples", () => {
		const result = generateHooksTemplate();

		expect(result).toContain("# Hook configuration");
		expect(result).toContain("# [[PreToolUse]]");
		expect(result).toContain("# [[PostToolUse]]");
		expect(result).toContain("# [[SessionStart]]");
	});

	test("uses OMNIDEV_ variable prefix", () => {
		const result = generateHooksTemplate();

		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing for literal ${} in template output
		expect(result).toContain("${OMNIDEV_CAPABILITY_ROOT}");
		expect(result).not.toContain("${CLAUDE_");
	});

	test("includes common matchers", () => {
		const result = generateHooksTemplate();

		expect(result).toContain('matcher = "Bash"');
		expect(result).toContain('matcher = "Write|Edit"');
	});
});

describe("generateHookScript", () => {
	test("generates bash script with shebang", () => {
		const result = generateHookScript();

		expect(result).toMatch(/^#!/);
		expect(result).toContain("#!/bin/bash");
	});

	test("includes stdin reading pattern", () => {
		const result = generateHookScript();

		expect(result).toContain("INPUT=$(cat)");
	});

	test("includes jq extraction examples", () => {
		const result = generateHookScript();

		expect(result).toContain("jq");
		expect(result).toContain("tool_name");
	});

	test("ends with exit 0", () => {
		const result = generateHookScript();

		expect(result).toContain("exit 0");
	});
});
