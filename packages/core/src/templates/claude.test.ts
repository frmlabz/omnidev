import { describe, expect, test } from "bun:test";
import { generateClaudeTemplate, generateInstructionsTemplate } from "./claude";

describe("generateClaudeTemplate", () => {
	test("generates CLAUDE.md template with reference to instructions", () => {
		const template = generateClaudeTemplate();

		expect(template).toContain("# Project Instructions");
		expect(template).toContain("@import .omni/instructions.md");
	});

	test("includes placeholder for project-specific instructions", () => {
		const template = generateClaudeTemplate();

		expect(template).toContain("<!-- Add your project-specific instructions here -->");
	});

	test("includes OmniDev section", () => {
		const template = generateClaudeTemplate();

		expect(template).toContain("## OmniDev");
	});
});

describe("generateInstructionsTemplate", () => {
	test("generates instructions with project description placeholder", () => {
		const template = generateInstructionsTemplate();

		expect(template).toContain("# OmniDev Instructions");
		expect(template).toContain("## Project Description");
		expect(template).toContain("<!-- TODO: Add 2-3 sentences describing your project -->");
		expect(template).toContain("[Describe what this project does and its main purpose]");
	});

	test("includes capabilities section with placeholder", () => {
		const template = generateInstructionsTemplate();

		expect(template).toContain("## Capabilities");
		expect(template).toContain("No capabilities enabled yet");
	});

	test("includes BEGIN/END markers for generated content", () => {
		const template = generateInstructionsTemplate();

		expect(template).toContain("BEGIN OMNIDEV GENERATED CONTENT");
		expect(template).toContain("END OMNIDEV GENERATED CONTENT");
	});
});
