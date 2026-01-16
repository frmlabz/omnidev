import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCapabilityRegistry } from "./registry";

describe("buildCapabilityRegistry", () => {
	const testDir = "test-capability-registry";
	const omniDir = join(testDir, ".omni");
	const capabilitiesDir = join(testDir, ".omni", "capabilities");
	let originalCwd: string;

	beforeEach(() => {
		// Save current working directory
		originalCwd = process.cwd();

		// Create test directory structure
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(capabilitiesDir, { recursive: true });
		mkdirSync(omniDir, { recursive: true });

		// Create default config with profiles
		writeFileSync(
			join(testDir, "omni.toml"),
			`project = "test"
active_profile = "default"

[profiles.default]
capabilities = ["cap1", "cap2"]
`,
		);

		// Change to test directory
		process.chdir(testDir);
	});

	afterEach(() => {
		// Restore working directory
		process.chdir(originalCwd);

		// Cleanup
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("builds empty registry when no capabilities exist", async () => {
		const registry = await buildCapabilityRegistry();

		expect(registry.capabilities.size).toBe(0);
		expect(registry.getAllCapabilities()).toEqual([]);
		expect(registry.getAllSkills()).toEqual([]);
		expect(registry.getAllRules()).toEqual([]);
		expect(registry.getAllDocs()).toEqual([]);
	});

	test("builds registry with single enabled capability", async () => {
		// Create capability
		const cap1Path = join(".omni", "capabilities", "cap1");
		mkdirSync(cap1Path, { recursive: true });
		writeFileSync(
			join(cap1Path, "capability.toml"),
			`[capability]
id = "cap1"
name = "Capability 1"
version = "1.0.0"
description = "First capability"`,
		);

		const registry = await buildCapabilityRegistry();

		expect(registry.capabilities.size).toBe(1);
		expect(registry.getCapability("cap1")).toBeDefined();
		expect(registry.getCapability("cap1")?.id).toBe("cap1");
	});

	test("builds registry with multiple enabled capabilities", async () => {
		// Create cap1
		const cap1Path = join(".omni", "capabilities", "cap1");
		mkdirSync(cap1Path, { recursive: true });
		writeFileSync(
			join(cap1Path, "capability.toml"),
			`[capability]
id = "cap1"
name = "Capability 1"
version = "1.0.0"
description = "First capability"`,
		);

		// Create cap2
		const cap2Path = join(".omni", "capabilities", "cap2");
		mkdirSync(cap2Path, { recursive: true });
		writeFileSync(
			join(cap2Path, "capability.toml"),
			`[capability]
id = "cap2"
name = "Capability 2"
version = "1.0.0"
description = "Second capability"`,
		);

		const registry = await buildCapabilityRegistry();

		expect(registry.capabilities.size).toBe(2);
		expect(registry.getCapability("cap1")).toBeDefined();
		expect(registry.getCapability("cap2")).toBeDefined();
		expect(registry.getAllCapabilities()).toHaveLength(2);
	});

	test("filters out disabled capabilities", async () => {
		// Update config to only enable cap1
		writeFileSync(
			join("omni.toml"),
			`project = "test"
active_profile = "default"

[profiles.default]
capabilities = ["cap1"]
`,
		);

		// Create cap1 (enabled)
		const cap1Path = join(".omni", "capabilities", "cap1");
		mkdirSync(cap1Path, { recursive: true });
		writeFileSync(
			join(cap1Path, "capability.toml"),
			`[capability]
id = "cap1"
name = "Capability 1"
version = "1.0.0"
description = "Enabled capability"`,
		);

		// Create cap2 (not enabled)
		const cap2Path = join(".omni", "capabilities", "cap2");
		mkdirSync(cap2Path, { recursive: true });
		writeFileSync(
			join(cap2Path, "capability.toml"),
			`[capability]
id = "cap2"
name = "Capability 2"
version = "1.0.0"
description = "Disabled capability"`,
		);

		const registry = await buildCapabilityRegistry();

		expect(registry.capabilities.size).toBe(1);
		expect(registry.getCapability("cap1")).toBeDefined();
		expect(registry.getCapability("cap2")).toBeUndefined();
	});

	test("respects active profile configuration", async () => {
		// Create config with dev profile that enables both cap1 and cap2
		writeFileSync(
			join("omni.toml"),
			`project = "test"
active_profile = "dev"

[profiles.default]
capabilities = ["cap1"]

[profiles.dev]
capabilities = ["cap1", "cap2"]
`,
		);

		// Create cap1
		const cap1Path = join(".omni", "capabilities", "cap1");
		mkdirSync(cap1Path, { recursive: true });
		writeFileSync(
			join(cap1Path, "capability.toml"),
			`[capability]
id = "cap1"
name = "Capability 1"
version = "1.0.0"
description = "Base capability"`,
		);

		// Create cap2
		const cap2Path = join(".omni", "capabilities", "cap2");
		mkdirSync(cap2Path, { recursive: true });
		writeFileSync(
			join(cap2Path, "capability.toml"),
			`[capability]
id = "cap2"
name = "Capability 2"
version = "1.0.0"
description = "Profile capability"`,
		);

		const registry = await buildCapabilityRegistry();

		// Should have both cap1 and cap2 since dev profile is active
		expect(registry.capabilities.size).toBe(2);
		expect(registry.getCapability("cap1")).toBeDefined();
		expect(registry.getCapability("cap2")).toBeDefined();
	});

	test("getAllSkills returns skills from all capabilities", async () => {
		// Create cap1 with skill
		const cap1Path = join(".omni", "capabilities", "cap1");
		mkdirSync(cap1Path, { recursive: true });
		writeFileSync(
			join(cap1Path, "capability.toml"),
			`[capability]
id = "cap1"
name = "Capability 1"
version = "1.0.0"
description = "Has skill"`,
		);
		const skill1Path = join(cap1Path, "skills", "skill1");
		mkdirSync(skill1Path, { recursive: true });
		writeFileSync(
			join(skill1Path, "SKILL.md"),
			`---
name: skill1
description: Skill 1
---
Instructions 1`,
		);

		// Create cap2 with skill
		const cap2Path = join(".omni", "capabilities", "cap2");
		mkdirSync(cap2Path, { recursive: true });
		writeFileSync(
			join(cap2Path, "capability.toml"),
			`[capability]
id = "cap2"
name = "Capability 2"
version = "1.0.0"
description = "Has skill"`,
		);
		const skill2Path = join(cap2Path, "skills", "skill2");
		mkdirSync(skill2Path, { recursive: true });
		writeFileSync(
			join(skill2Path, "SKILL.md"),
			`---
name: skill2
description: Skill 2
---
Instructions 2`,
		);

		const registry = await buildCapabilityRegistry();

		const skills = registry.getAllSkills();
		expect(skills).toHaveLength(2);
		expect(skills.find((s) => s.name === "skill1")).toBeDefined();
		expect(skills.find((s) => s.name === "skill2")).toBeDefined();
	});

	test("getAllRules returns rules from all capabilities", async () => {
		// Create cap1 with rule
		const cap1Path = join(".omni", "capabilities", "cap1");
		mkdirSync(cap1Path, { recursive: true });
		writeFileSync(
			join(cap1Path, "capability.toml"),
			`[capability]
id = "cap1"
name = "Capability 1"
version = "1.0.0"
description = "Has rule"`,
		);
		const rulesPath = join(cap1Path, "rules");
		mkdirSync(rulesPath, { recursive: true });
		writeFileSync(join(rulesPath, "rule1.md"), "Rule 1 content");

		// Create cap2 with rule
		const cap2Path = join(".omni", "capabilities", "cap2");
		mkdirSync(cap2Path, { recursive: true });
		writeFileSync(
			join(cap2Path, "capability.toml"),
			`[capability]
id = "cap2"
name = "Capability 2"
version = "1.0.0"
description = "Has rule"`,
		);
		const rules2Path = join(cap2Path, "rules");
		mkdirSync(rules2Path, { recursive: true });
		writeFileSync(join(rules2Path, "rule2.md"), "Rule 2 content");

		const registry = await buildCapabilityRegistry();

		const rules = registry.getAllRules();
		expect(rules).toHaveLength(2);
		expect(rules.find((r) => r.name === "rule1")).toBeDefined();
		expect(rules.find((r) => r.name === "rule2")).toBeDefined();
	});

	test("getAllDocs returns docs from all capabilities", async () => {
		// Create cap1 with doc
		const cap1Path = join(".omni", "capabilities", "cap1");
		mkdirSync(cap1Path, { recursive: true });
		writeFileSync(
			join(cap1Path, "capability.toml"),
			`[capability]
id = "cap1"
name = "Capability 1"
version = "1.0.0"
description = "Has doc"`,
		);
		writeFileSync(join(cap1Path, "definition.md"), "# Cap1 Definition");

		// Create cap2 with doc
		const cap2Path = join(".omni", "capabilities", "cap2");
		mkdirSync(cap2Path, { recursive: true });
		writeFileSync(
			join(cap2Path, "capability.toml"),
			`[capability]
id = "cap2"
name = "Capability 2"
version = "1.0.0"
description = "Has doc"`,
		);
		writeFileSync(join(cap2Path, "definition.md"), "# Cap2 Definition");

		const registry = await buildCapabilityRegistry();

		const docs = registry.getAllDocs();
		expect(docs).toHaveLength(2);
		expect(docs.every((d) => d.name === "definition")).toBe(true);
		expect(docs.find((d) => d.capabilityId === "cap1")).toBeDefined();
		expect(docs.find((d) => d.capabilityId === "cap2")).toBeDefined();
	});

	test("handles capability loading errors gracefully", async () => {
		// Create valid capability
		const cap1Path = join(".omni", "capabilities", "cap1");
		mkdirSync(cap1Path, { recursive: true });
		writeFileSync(
			join(cap1Path, "capability.toml"),
			`[capability]
id = "cap1"
name = "Valid Capability"
version = "1.0.0"
description = "Valid"`,
		);

		// Create invalid capability
		const cap2Path = join(".omni", "capabilities", "cap2");
		mkdirSync(cap2Path, { recursive: true });
		writeFileSync(
			join(cap2Path, "capability.toml"),
			`[capability]
id = "cap2"
# Missing required fields`,
		);

		const registry = await buildCapabilityRegistry();

		// Should only have the valid capability
		expect(registry.capabilities.size).toBe(1);
		expect(registry.getCapability("cap1")).toBeDefined();
		expect(registry.getCapability("cap2")).toBeUndefined();
	});

	test("validates environment requirements before loading", async () => {
		// Create capability requiring env var
		const capPath = join(".omni", "capabilities", "cap1");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "cap1"
name = "Needs Env"
version = "1.0.0"
description = "Requires env"

[env.REQUIRED_VAR]
required = true`,
		);

		const registry = await buildCapabilityRegistry();

		// Should not load capability without required env var
		expect(registry.capabilities.size).toBe(0);
	});

	test("loads capabilities when environment is satisfied", async () => {
		// Create .env file with required var
		writeFileSync(join(".omni", ".env"), "REQUIRED_VAR=test-value");

		// Create capability requiring env var
		const capPath = join(".omni", "capabilities", "cap1");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "cap1"
name = "Needs Env"
version = "1.0.0"
description = "Requires env"

[env.REQUIRED_VAR]
required = true`,
		);

		const registry = await buildCapabilityRegistry();

		// Should load capability when env var is provided
		expect(registry.capabilities.size).toBe(1);
		expect(registry.getCapability("cap1")).toBeDefined();
	});

	test("getCapability returns undefined for non-existent capability", async () => {
		const registry = await buildCapabilityRegistry();

		expect(registry.getCapability("non-existent")).toBeUndefined();
	});

	test("getAllCapabilities returns empty array when no capabilities", async () => {
		const registry = await buildCapabilityRegistry();

		expect(registry.getAllCapabilities()).toEqual([]);
	});

	test("getAllSkills returns empty array when capabilities have no skills", async () => {
		// Create capability without skills
		const capPath = join(".omni", "capabilities", "cap1");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "cap1"
name = "No Skills"
version = "1.0.0"
description = "Has no skills"`,
		);

		const registry = await buildCapabilityRegistry();

		expect(registry.getAllSkills()).toEqual([]);
	});

	test("getAllRules returns empty array when capabilities have no rules", async () => {
		// Create capability without rules
		const capPath = join(".omni", "capabilities", "cap1");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "cap1"
name = "No Rules"
version = "1.0.0"
description = "Has no rules"`,
		);

		const registry = await buildCapabilityRegistry();

		expect(registry.getAllRules()).toEqual([]);
	});

	test("getAllDocs returns empty array when capabilities have no docs", async () => {
		// Create capability without docs
		const capPath = join(".omni", "capabilities", "cap1");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "cap1"
name = "No Docs"
version = "1.0.0"
description = "Has no docs"`,
		);

		const registry = await buildCapabilityRegistry();

		expect(registry.getAllDocs()).toEqual([]);
	});
});
