import { describe, expect, test } from "bun:test";
import { generateAgentsTemplate } from "./agents";

describe("generateAgentsTemplate", () => {
	test("generates AGENTS.md template with reference to instructions", () => {
		const template = generateAgentsTemplate();

		expect(template).toContain("# Project Instructions");
		expect(template).toContain("@import .omni/instructions.md");
	});

	test("includes placeholder for project-specific instructions", () => {
		const template = generateAgentsTemplate();

		expect(template).toContain("<!-- Add your project-specific instructions here -->");
	});

	test("includes OmniDev section", () => {
		const template = generateAgentsTemplate();

		expect(template).toContain("## OmniDev");
	});
});
