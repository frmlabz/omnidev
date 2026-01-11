import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRules } from "./rules";

describe("loadRules", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(process.cwd(), "test-capability-rules");
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (testDir) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("returns empty array when rules directory does not exist", async () => {
		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toEqual([]);
	});

	test("returns empty array when rules directory is empty", async () => {
		mkdirSync(join(testDir, "rules"));
		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toEqual([]);
	});

	test("loads single rule from rules directory", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		writeFileSync(join(rulesDir, "test-rule.md"), "# Test Rule\n\nThis is a test rule.");

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(1);
		expect(rules[0]?.name).toBe("test-rule");
		expect(rules[0]?.content).toBe("# Test Rule\n\nThis is a test rule.");
		expect(rules[0]?.capabilityId).toBe("test-cap");
	});

	test("loads multiple rules from rules directory", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		writeFileSync(join(rulesDir, "rule-one.md"), "# Rule One");
		writeFileSync(join(rulesDir, "rule-two.md"), "# Rule Two");
		writeFileSync(join(rulesDir, "rule-three.md"), "# Rule Three");

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(3);

		const names = rules.map((r) => r.name).sort();
		expect(names).toEqual(["rule-one", "rule-three", "rule-two"]);
	});

	test("trims whitespace from rule content", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		writeFileSync(join(rulesDir, "trimmed.md"), "\n\n  # Trimmed Rule\n\nContent here.\n\n  ");

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(1);
		expect(rules[0]?.content).toBe("# Trimmed Rule\n\nContent here.");
	});

	test("ignores non-markdown files in rules directory", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		writeFileSync(join(rulesDir, "rule.md"), "# Rule");
		writeFileSync(join(rulesDir, "readme.txt"), "Not a markdown file");
		writeFileSync(join(rulesDir, "config.json"), "{}");

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(1);
		expect(rules[0]?.name).toBe("rule");
	});

	test("ignores directories in rules directory", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		mkdirSync(join(rulesDir, "subdir"));
		writeFileSync(join(rulesDir, "rule.md"), "# Rule");

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(1);
		expect(rules[0]?.name).toBe("rule");
	});

	test("handles rules with complex markdown formatting", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		const complexMarkdown = `# Complex Rule

## Section 1

- List item 1
- List item 2

\`\`\`typescript
const code = "example";
\`\`\`

**Bold text** and *italic text*.`;

		writeFileSync(join(rulesDir, "complex.md"), complexMarkdown);

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(1);
		expect(rules[0]?.content).toBe(complexMarkdown);
	});

	test("handles empty rule files", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		writeFileSync(join(rulesDir, "empty.md"), "");

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(1);
		expect(rules[0]?.content).toBe("");
	});

	test("handles rules with only whitespace", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		writeFileSync(join(rulesDir, "whitespace.md"), "   \n\n   ");

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(1);
		expect(rules[0]?.content).toBe("");
	});

	test("handles rule names with hyphens and underscores", async () => {
		const rulesDir = join(testDir, "rules");
		mkdirSync(rulesDir);
		writeFileSync(join(rulesDir, "my-rule-name.md"), "Content");
		writeFileSync(join(rulesDir, "another_rule_name.md"), "Content");

		const rules = await loadRules(testDir, "test-cap");
		expect(rules).toHaveLength(2);

		const names = rules.map((r) => r.name).sort();
		expect(names).toEqual(["another_rule_name", "my-rule-name"]);
	});
});
