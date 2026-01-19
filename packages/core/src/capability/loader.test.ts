import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { discoverCapabilities, loadCapability, loadCapabilityConfig } from "./loader";

describe("discoverCapabilities", () => {
	const testDir = setupTestDir("test-capabilities-", { chdir: true });
	let capabilitiesDir: string;

	beforeEach(() => {
		// Create test directory in os temp dir
		capabilitiesDir = join(testDir.path, "omni", "capabilities");
		mkdirSync(capabilitiesDir, { recursive: true });
	});

	test("returns empty array when capabilities directory does not exist", async () => {
		// Remove the capabilities directory
		rmSync(".omni/capabilities", { recursive: true, force: true });

		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual([]);
	});

	test("returns empty array when capabilities directory is empty", async () => {
		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual([]);
	});

	test("discovers a single capability with capability.toml", async () => {
		// Create a capability directory with capability.toml
		const capPath = join(".omni", "capabilities", "test-cap");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(join(capPath, "capability.toml"), '[capability]\nid = "test-cap"');

		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual([".omni/capabilities/test-cap"]);
	});

	test("discovers multiple capabilities with capability.toml", async () => {
		// Create multiple capability directories
		const cap1Path = join(".omni", "capabilities", "capability-1");
		const cap2Path = join(".omni", "capabilities", "capability-2");
		const cap3Path = join(".omni", "capabilities", "capability-3");

		mkdirSync(cap1Path, { recursive: true });
		mkdirSync(cap2Path, { recursive: true });
		mkdirSync(cap3Path, { recursive: true });

		writeFileSync(join(cap1Path, "capability.toml"), '[capability]\nid = "capability-1"');
		writeFileSync(join(cap2Path, "capability.toml"), '[capability]\nid = "capability-2"');
		writeFileSync(join(cap3Path, "capability.toml"), '[capability]\nid = "capability-3"');

		const capabilities = await discoverCapabilities();

		expect(capabilities).toHaveLength(3);
		expect(capabilities).toContain(".omni/capabilities/capability-1");
		expect(capabilities).toContain(".omni/capabilities/capability-2");
		expect(capabilities).toContain(".omni/capabilities/capability-3");
	});

	test("ignores directories without capability.toml", async () => {
		// Create directory without capability.toml
		const notACapPath = join(".omni", "capabilities", "not-a-capability");
		mkdirSync(notACapPath, { recursive: true });
		writeFileSync(join(notACapPath, "README.md"), "# Not a capability");

		// Create a valid capability
		const validCapPath = join(".omni", "capabilities", "valid-cap");
		mkdirSync(validCapPath, { recursive: true });
		writeFileSync(join(validCapPath, "capability.toml"), '[capability]\nid = "valid-cap"');

		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual([".omni/capabilities/valid-cap"]);
	});

	test("ignores files in capabilities directory", async () => {
		// Create the capabilities directory first
		mkdirSync(join(".omni", "capabilities"), { recursive: true });

		// Create a file in the capabilities directory (not a subdirectory)
		writeFileSync(join(".omni", "capabilities", "README.md"), "# Capabilities");

		// Create a valid capability
		const validCapPath = join(".omni", "capabilities", "valid-cap");
		mkdirSync(validCapPath, { recursive: true });
		writeFileSync(join(validCapPath, "capability.toml"), '[capability]\nid = "valid-cap"');

		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual([".omni/capabilities/valid-cap"]);
	});

	test("handles nested directories correctly (does not recurse)", async () => {
		// Create a nested structure - should only discover top-level capabilities
		const cap1Path = join(".omni", "capabilities", "capability-1");
		const nestedCapPath = join(cap1Path, "nested-capability");

		mkdirSync(cap1Path, { recursive: true });
		mkdirSync(nestedCapPath, { recursive: true });

		writeFileSync(join(cap1Path, "capability.toml"), '[capability]\nid = "capability-1"');
		writeFileSync(join(nestedCapPath, "capability.toml"), '[capability]\nid = "nested"');

		const capabilities = await discoverCapabilities();

		// Should only find the top-level capability, not the nested one
		expect(capabilities).toEqual([".omni/capabilities/capability-1"]);
	});

	test("returns paths in consistent format", async () => {
		const capPath = join(".omni", "capabilities", "test-cap");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(join(capPath, "capability.toml"), '[capability]\nid = "test-cap"');

		const capabilities = await discoverCapabilities();

		// Path should use forward slashes or be normalized
		expect(capabilities[0]).toMatch(/^\.omni\/capabilities\/test-cap$/);
	});
});

describe("loadCapabilityConfig", () => {
	const testDir = setupTestDir("test-capability-config-", { chdir: true });
	let capabilitiesDir: string;

	beforeEach(() => {
		// Create test directory in os temp dir
		capabilitiesDir = join(testDir.path, ".omni", "capabilities");
		mkdirSync(capabilitiesDir, { recursive: true });
	});

	test("loads valid capability config with all required fields", async () => {
		const capPath = join(".omni", "capabilities", "test-cap");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "test-cap"
name = "Test Capability"
version = "1.0.0"
description = "A test capability"`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe("test-cap");
		expect(config.capability.name).toBe("Test Capability");
		expect(config.capability.version).toBe("1.0.0");
		expect(config.capability.description).toBe("A test capability");
	});

	test("loads capability config with optional exports field", async () => {
		const capPath = join(".omni", "capabilities", "with-exports");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "with-exports"
name = "With Exports"
version = "1.0.0"
description = "Has exports"

[exports]
functions = ["create", "list", "get"]`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe("with-exports");
		expect(config.exports?.functions).toEqual(["create", "list", "get"]);
	});

	test("loads capability config with optional env field", async () => {
		const capPath = join(".omni", "capabilities", "with-env");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "with-env"
name = "With Env"
version = "1.0.0"
description = "Has env vars"

[[env]]
key = "API_KEY"
description = "API key"
required = true
secret = true`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe("with-env");
		expect(config.env).toBeDefined();
		expect(config.env?.[0]?.key).toBe("API_KEY");
		expect(config.env?.[0]?.required).toBe(true);
		expect(config.env?.[0]?.secret).toBe(true);
	});

	test("throws error when capability.toml is missing", async () => {
		const capPath = join(".omni", "capabilities", "missing-config");
		mkdirSync(capPath, { recursive: true });

		// No capability.toml file created

		expect(async () => await loadCapabilityConfig(capPath)).toThrow();
	});

	test("throws error when capability.toml has missing required fields", async () => {
		const capPath = join(".omni", "capabilities", "invalid");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "invalid"
# Missing name, version, description`,
		);

		expect(async () => await loadCapabilityConfig(capPath)).toThrow();
	});

	test("throws error when capability.toml has invalid TOML syntax", async () => {
		const capPath = join(".omni", "capabilities", "bad-toml");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability
id = "bad-toml"
# Missing closing bracket`,
		);

		expect(async () => await loadCapabilityConfig(capPath)).toThrow();
	});

	test("handles capability config with all optional fields defined", async () => {
		const capPath = join(".omni", "capabilities", "complete-cap");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "complete-cap"
name = "Complete Capability"
version = "1.0.0"
description = "Has all fields"

[exports]
functions = ["fn1", "fn2"]

[[env]]
key = "VAR1"
description = "Variable 1"
required = true
secret = false

[[env]]
key = "VAR2"
description = "Variable 2"
required = false
secret = true
`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe("complete-cap");
		expect(config.exports?.functions).toEqual(["fn1", "fn2"]);
		expect(config.env).toHaveLength(2);
	});
});

describe("loadCapability", () => {
	const testDir = setupTestDir("test-load-capability-", { chdir: true });
	let capabilitiesDir: string;

	beforeEach(() => {
		// Create test directory in os temp dir
		capabilitiesDir = join(testDir.path, "omni", "capabilities");
		mkdirSync(capabilitiesDir, { recursive: true });
	});

	test("loads capability with minimal config (no optional fields)", async () => {
		const capPath = join(".omni", "capabilities", "minimal-cap");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "minimal-cap"
name = "Minimal Capability"
version = "1.0.0"
description = "A minimal capability"`,
		);

		const capability = await loadCapability(capPath, {});

		expect(capability.id).toBe("minimal-cap");
		expect(capability.path).toBe(capPath);
		expect(capability.config.capability.name).toBe("Minimal Capability");
		expect(capability.skills).toEqual([]);
		expect(capability.rules).toEqual([]);
		expect(capability.docs).toEqual([]);
		expect(capability.typeDefinitions).toBeUndefined();
		expect(capability.exports).toEqual({});
	});

	test("loads capability with skills from filesystem", async () => {
		const capPath = join(".omni", "capabilities", "with-skills");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "with-skills"
name = "With Skills"
version = "1.0.0"
description = "Has skills"`,
		);

		// Create a skill
		const skillPath = join(capPath, "skills", "test-skill");
		mkdirSync(skillPath, { recursive: true });
		writeFileSync(
			join(skillPath, "SKILL.md"),
			`---
name: test-skill
description: A test skill
---
Do something useful`,
		);

		const capability = await loadCapability(capPath, {});

		expect(capability.skills).toHaveLength(1);
		expect(capability.skills[0]?.name).toBe("test-skill");
		expect(capability.skills[0]?.description).toBe("A test skill");
		expect(capability.skills[0]?.instructions).toBe("Do something useful");
		expect(capability.skills[0]?.capabilityId).toBe("with-skills");
	});

	test("loads capability with rules from filesystem", async () => {
		const capPath = join(".omni", "capabilities", "with-rules");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "with-rules"
name = "With Rules"
version = "1.0.0"
description = "Has rules"`,
		);

		// Create rules
		const rulesPath = join(capPath, "rules");
		mkdirSync(rulesPath, { recursive: true });
		writeFileSync(join(rulesPath, "rule-1.md"), "Rule 1 content");
		writeFileSync(join(rulesPath, "rule-2.md"), "Rule 2 content");

		const capability = await loadCapability(capPath, {});

		expect(capability.rules).toHaveLength(2);
		expect(capability.rules.find((r) => r.name === "rule-1")).toBeDefined();
		expect(capability.rules.find((r) => r.name === "rule-2")).toBeDefined();
	});

	test("loads capability with docs from filesystem", async () => {
		const capPath = join(".omni", "capabilities", "with-docs");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "with-docs"
name = "With Docs"
version = "1.0.0"
description = "Has docs"`,
		);

		// Create definition.md
		writeFileSync(join(capPath, "definition.md"), "# Definition");

		// Create docs
		const docsPath = join(capPath, "docs");
		mkdirSync(docsPath, { recursive: true });
		writeFileSync(join(docsPath, "guide.md"), "# Guide");

		const capability = await loadCapability(capPath, {});

		expect(capability.docs).toHaveLength(2);
		expect(capability.docs.find((d) => d.name === "definition")).toBeDefined();
		expect(capability.docs.find((d) => d.name === "guide")).toBeDefined();
	});

	test("loads capability with type definitions from filesystem", async () => {
		const capPath = join(".omni", "capabilities", "with-types");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "with-types"
name = "With Types"
version = "1.0.0"
description = "Has type definitions"`,
		);

		// Create types.d.ts
		writeFileSync(join(capPath, "types.d.ts"), "export function doSomething(): void;");

		const capability = await loadCapability(capPath, {});

		expect(capability.typeDefinitions).toBe("export function doSomething(): void;");
	});

	test("loads capability with exports from index.ts", async () => {
		const capPath = join(".omni", "capabilities", "with-exports");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "with-exports"
name = "With Exports"
version = "1.0.0"
description = "Has exports"`,
		);

		// Create index.ts with exports
		writeFileSync(join(capPath, "index.ts"), 'export function myFunction() { return "hello"; }');

		const capability = await loadCapability(capPath, {});

		expect(capability.exports).toBeDefined();
		expect(typeof capability.exports.myFunction).toBe("function");
	});

	test("validates environment variables when config has env requirements", async () => {
		const capPath = join(".omni", "capabilities", "needs-env");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "needs-env"
name = "Needs Env"
version = "1.0.0"
description = "Requires env vars"

[env.API_KEY]
required = true`,
		);

		// Should throw when required env var is missing
		expect(async () => await loadCapability(capPath, {})).toThrow();

		// Should succeed when env var is provided
		const capability = await loadCapability(capPath, { API_KEY: "test-key" });
		expect(capability.id).toBe("needs-env");
	});

	test("programmatic skills take precedence over filesystem", async () => {
		const capPath = join(".omni", "capabilities", "programmatic-skills");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "programmatic-skills"
name = "Programmatic Skills"
version = "1.0.0"
description = "Has programmatic skills"`,
		);

		// Create filesystem skill
		const skillPath = join(capPath, "skills", "fs-skill");
		mkdirSync(skillPath, { recursive: true });
		writeFileSync(
			join(skillPath, "SKILL.md"),
			`---
name: fs-skill
description: Filesystem skill
---
From filesystem`,
		);

		// Create index.ts with programmatic skills
		writeFileSync(
			join(capPath, "index.ts"),
			`export const skills = [
  {
    skillMd: \`---
name: programmatic-skill
description: Programmatic skill
---
From code\`
  }
];`,
		);

		const capability = await loadCapability(capPath, {});

		// Should have programmatic skills, not filesystem ones
		expect(capability.skills).toHaveLength(1);
		expect(capability.skills[0]?.name).toBe("programmatic-skill");
		expect(capability.skills[0]?.instructions).toBe("From code");
	});

	test("programmatic rules take precedence over filesystem", async () => {
		const capPath = join(".omni", "capabilities", "programmatic-rules");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "programmatic-rules"
name = "Programmatic Rules"
version = "1.0.0"
description = "Has programmatic rules"`,
		);

		// Create filesystem rule
		const rulesPath = join(capPath, "rules");
		mkdirSync(rulesPath, { recursive: true });
		writeFileSync(join(rulesPath, "fs-rule.md"), "From filesystem");

		// Create index.ts with programmatic rules (new format)
		writeFileSync(
			join(capPath, "index.ts"),
			`export const rules = [
  'From code'
];`,
		);

		const capability = await loadCapability(capPath, {});

		// Should have programmatic rules, not filesystem ones
		expect(capability.rules).toHaveLength(1);
		expect(capability.rules[0]?.name).toBe("rule-1");
		expect(capability.rules[0]?.content).toBe("From code");
	});

	test("programmatic docs take precedence over filesystem", async () => {
		const capPath = join(".omni", "capabilities", "programmatic-docs");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "programmatic-docs"
name = "Programmatic Docs"
version = "1.0.0"
description = "Has programmatic docs"`,
		);

		// Create filesystem doc
		writeFileSync(join(capPath, "definition.md"), "From filesystem");

		// Create index.ts with programmatic docs (new format)
		writeFileSync(
			join(capPath, "index.ts"),
			`export const docs = [
  {
    title: 'programmatic-doc',
    content: 'From code'
  }
];`,
		);

		const capability = await loadCapability(capPath, {});

		// Should have programmatic docs, not filesystem ones
		expect(capability.docs).toHaveLength(1);
		expect(capability.docs[0]?.name).toBe("programmatic-doc");
		expect(capability.docs[0]?.content).toBe("From code");
	});

	test("programmatic type definitions take precedence over filesystem", async () => {
		const capPath = join(".omni", "capabilities", "programmatic-types");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "programmatic-types"
name = "Programmatic Types"
version = "1.0.0"
description = "Has programmatic type definitions"`,
		);

		// Create filesystem types
		writeFileSync(join(capPath, "types.d.ts"), "export type Foo = string;");

		// Create index.ts with programmatic type definitions
		writeFileSync(
			join(capPath, "index.ts"),
			'export const typeDefinitions = "export type Bar = number;";',
		);

		const capability = await loadCapability(capPath, {});

		// Should have programmatic type definitions, not filesystem ones
		expect(capability.typeDefinitions).toBe("export type Bar = number;");
	});

	test("throws error when index.ts has import errors", async () => {
		const capPath = join(".omni", "capabilities", "bad-import");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "bad-import"
name = "Bad Import"
version = "1.0.0"
description = "Has import errors"`,
		);

		// Create index.ts with syntax error
		writeFileSync(join(capPath, "index.ts"), "export const foo = bar; // bar is undefined");

		// Should throw when trying to import
		expect(async () => await loadCapability(capPath, {})).toThrow();
	});

	test("loads complete capability with all features", async () => {
		const capPath = join(".omni", "capabilities", "complete");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "complete"
name = "Complete Capability"
version = "2.0.0"
description = "Has everything"`,
		);

		// Create skills
		const skillPath = join(capPath, "skills", "skill1");
		mkdirSync(skillPath, { recursive: true });
		writeFileSync(
			join(skillPath, "SKILL.md"),
			`---
name: skill1
description: First skill
---
Skill instructions`,
		);

		// Create rules
		const rulesPath = join(capPath, "rules");
		mkdirSync(rulesPath, { recursive: true });
		writeFileSync(join(rulesPath, "rule1.md"), "Rule content");

		// Create docs
		writeFileSync(join(capPath, "definition.md"), "# Definition");
		const docsPath = join(capPath, "docs");
		mkdirSync(docsPath, { recursive: true });
		writeFileSync(join(docsPath, "guide.md"), "# Guide");

		// Create types
		writeFileSync(join(capPath, "types.d.ts"), "export type T = string;");

		// Create exports
		writeFileSync(join(capPath, "index.ts"), "export function helper() { return 42; }");

		const capability = await loadCapability(capPath, {});

		expect(capability.id).toBe("complete");
		expect(capability.skills).toHaveLength(1);
		expect(capability.rules).toHaveLength(1);
		expect(capability.docs).toHaveLength(2);
		expect(capability.typeDefinitions).toBe("export type T = string;");
		expect(typeof capability.exports.helper).toBe("function");
	});

	test("loads capability without hooks when hooks.toml is missing", async () => {
		const capPath = join(".omni", "capabilities", "no-hooks");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "no-hooks"
name = "No Hooks"
version = "1.0.0"
description = "Has no hooks"`,
		);

		const capability = await loadCapability(capPath, {});

		expect(capability.id).toBe("no-hooks");
		expect(capability.hooks).toBeUndefined();
	});

	test("loads capability with hooks from hooks/hooks.toml", async () => {
		const capPath = join(".omni", "capabilities", "with-hooks");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "with-hooks"
name = "With Hooks"
version = "1.0.0"
description = "Has hooks"`,
		);

		// Create hooks directory and hooks.toml
		const hooksPath = join(capPath, "hooks");
		mkdirSync(hooksPath, { recursive: true });
		writeFileSync(
			join(hooksPath, "hooks.toml"),
			`description = "Test hooks"

[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = "echo test"`,
		);

		const capability = await loadCapability(capPath, {});

		expect(capability.id).toBe("with-hooks");
		expect(capability.hooks).toBeDefined();
		expect(capability.hooks?.capabilityName).toBe("with-hooks");
		expect(capability.hooks?.config.PreToolUse).toHaveLength(1);
		expect(capability.hooks?.config.PreToolUse?.[0]?.matcher).toBe("Bash");
	});

	test("loads capability with hooks and transforms CLAUDE_ variables", async () => {
		const capPath = join(".omni", "capabilities", "hooks-transform");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "hooks-transform"
name = "Hooks Transform"
version = "1.0.0"
description = "Transforms variables"`,
		);

		// Create hooks with CLAUDE_ variables (as if imported from external source)
		const hooksPath = join(capPath, "hooks");
		mkdirSync(hooksPath, { recursive: true });
		writeFileSync(
			join(hooksPath, "hooks.toml"),
			`[[PreToolUse]]
matcher = "Bash"
[[PreToolUse.hooks]]
type = "command"
command = "\${CLAUDE_PLUGIN_ROOT}/hooks/validate.sh"`,
		);

		const capability = await loadCapability(capPath, {});

		// CLAUDE_PLUGIN_ROOT should be transformed to OMNIDEV_CAPABILITY_ROOT
		const command = capability.hooks?.config.PreToolUse?.[0]?.hooks[0];
		expect(command?.type).toBe("command");
		if (command?.type === "command") {
			expect(command.command).toContain("OMNIDEV_CAPABILITY_ROOT");
			expect(command.command).not.toContain("CLAUDE_PLUGIN_ROOT");
		}
	});

	test("hooks validation result is included in loaded capability", async () => {
		const capPath = join(".omni", "capabilities", "hooks-validation");
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, "capability.toml"),
			`[capability]
id = "hooks-validation"
name = "Hooks Validation"
version = "1.0.0"
description = "Has valid hooks"`,
		);

		const hooksPath = join(capPath, "hooks");
		mkdirSync(hooksPath, { recursive: true });
		writeFileSync(
			join(hooksPath, "hooks.toml"),
			`[[Stop]]
[[Stop.hooks]]
type = "prompt"
prompt = "Check completion"`,
		);

		const capability = await loadCapability(capPath, {});

		expect(capability.hooks?.validation).toBeDefined();
		expect(capability.hooks?.validation.valid).toBe(true);
		expect(capability.hooks?.validation.errors).toHaveLength(0);
	});
});
