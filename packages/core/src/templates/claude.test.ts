import { describe, test, expect } from "bun:test";
import { generateClaudeTemplate, generateClaudeAppendSection } from "./claude";

describe("generateClaudeTemplate", () => {
	test("generates claude.md template with project description placeholder", () => {
		const template = generateClaudeTemplate();

		expect(template).toContain("# Project Instructions");
		expect(template).toContain("## Project Description");
		expect(template).toContain("<!-- TODO: Add 2-3 sentences describing your project -->");
		expect(template).toContain("[Describe what this project does and its main purpose]");
	});

	test("references .omni/generated/rules.md", () => {
		const template = generateClaudeTemplate();

		expect(template).toContain("## Capabilities");
		expect(template).toContain("@import .omni/generated/rules.md");
	});

	test("includes information about OmniDev", () => {
		const template = generateClaudeTemplate();

		expect(template).toContain("OmniDev");
	});
});

describe("generateClaudeAppendSection", () => {
	test("generates append section with clear separator", () => {
		const section = generateClaudeAppendSection();

		expect(section).toContain("---");
		expect(section).toContain("# OmniDev Configuration");
	});

	test("includes project description placeholder", () => {
		const section = generateClaudeAppendSection();

		expect(section).toContain("## Project Description");
		expect(section).toContain("<!-- TODO: Add 2-3 sentences describing your project -->");
		expect(section).toContain("[Describe what this project does and its main purpose]");
	});

	test("references .omni/generated/rules.md", () => {
		const section = generateClaudeAppendSection();

		expect(section).toContain("## Capabilities");
		expect(section).toContain("@import .omni/generated/rules.md");
	});

	test("starts with newlines for proper separation", () => {
		const section = generateClaudeAppendSection();

		expect(section.startsWith("\n")).toBe(true);
	});
});
