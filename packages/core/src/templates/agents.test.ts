import { describe, test, expect } from "bun:test";
import { generateAgentsTemplate } from "./agents";

describe("generateAgentsTemplate", () => {
	test("generates AGENTS.md template with project description placeholder", () => {
		const template = generateAgentsTemplate();

		expect(template).toContain("# Project Instructions");
		expect(template).toContain("## Project Description");
		expect(template).toContain("<!-- TODO: Add 2-3 sentences describing your project -->");
		expect(template).toContain("[Describe what this project does and its main purpose]");
	});

	test("references .omni/generated/rules.md", () => {
		const template = generateAgentsTemplate();

		expect(template).toContain("## Capabilities");
		expect(template).toContain("@import .omni/generated/rules.md");
	});

	test("includes information about OmniDev", () => {
		const template = generateAgentsTemplate();

		expect(template).toContain("OmniDev");
	});
});
