import { describe, expect, test } from "bun:test";
import { generateClaudeTemplate } from "./claude";

describe("generateClaudeTemplate", () => {
	test("generates CLAUDE.md template with project instructions header", () => {
		const template = generateClaudeTemplate();

		expect(template).toContain("# Project Instructions");
	});

	test("includes placeholder for project-specific instructions", () => {
		const template = generateClaudeTemplate();

		expect(template).toContain("<!-- Add your project-specific instructions here -->");
	});
});
