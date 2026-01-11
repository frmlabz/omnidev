import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSkills } from "./skills";

describe("loadSkills", () => {
	const testDir = join(process.cwd(), "test-skills-temp");
	const capabilityPath = join(testDir, "test-capability");

	beforeEach(() => {
		mkdirSync(capabilityPath, { recursive: true });
	});

	afterEach(() => {
		if (testDir) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("returns empty array when skills directory does not exist", async () => {
		const skills = await loadSkills(capabilityPath, "test-cap");
		expect(skills).toEqual([]);
	});

	test("returns empty array when skills directory is empty", async () => {
		mkdirSync(join(capabilityPath, "skills"), { recursive: true });
		const skills = await loadSkills(capabilityPath, "test-cap");
		expect(skills).toEqual([]);
	});

	test("loads single skill with valid frontmatter and instructions", async () => {
		const skillsDir = join(capabilityPath, "skills", "test-skill");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `---
name: test-skill
description: A test skill
---

# Instructions

This is a test skill.`;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(1);
		expect(skills[0]).toEqual({
			name: "test-skill",
			description: "A test skill",
			instructions: "# Instructions\n\nThis is a test skill.",
			capabilityId: "test-cap",
		});
	});

	test("loads multiple skills from different directories", async () => {
		const skill1Dir = join(capabilityPath, "skills", "skill-1");
		const skill2Dir = join(capabilityPath, "skills", "skill-2");
		mkdirSync(skill1Dir, { recursive: true });
		mkdirSync(skill2Dir, { recursive: true });

		writeFileSync(
			join(skill1Dir, "SKILL.md"),
			`---
name: skill-1
description: First skill
---

Instructions for skill 1.`,
		);

		writeFileSync(
			join(skill2Dir, "SKILL.md"),
			`---
name: skill-2
description: Second skill
---

Instructions for skill 2.`,
		);

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(2);
		expect(skills[0]?.name).toBe("skill-1");
		expect(skills[1]?.name).toBe("skill-2");
	});

	test("skips skill directories without SKILL.md file", async () => {
		const validSkillDir = join(capabilityPath, "skills", "valid-skill");
		const invalidSkillDir = join(capabilityPath, "skills", "no-skill-file");
		mkdirSync(validSkillDir, { recursive: true });
		mkdirSync(invalidSkillDir, { recursive: true });

		writeFileSync(
			join(validSkillDir, "SKILL.md"),
			`---
name: valid-skill
description: Valid skill
---

Valid instructions.`,
		);

		// No SKILL.md in invalidSkillDir

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(1);
		expect(skills[0]?.name).toBe("valid-skill");
	});

	test("handles YAML frontmatter with quoted values", async () => {
		const skillsDir = join(capabilityPath, "skills", "quoted-skill");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `---
name: "quoted-skill"
description: "A skill with quoted values"
---

Instructions here.`;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(1);
		expect(skills[0]?.name).toBe("quoted-skill");
		expect(skills[0]?.description).toBe("A skill with quoted values");
	});

	test("handles YAML frontmatter with colons in values", async () => {
		const skillsDir = join(capabilityPath, "skills", "colon-skill");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `---
name: colon-skill
description: A skill with a colon: in the description
---

Instructions here.`;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(1);
		expect(skills[0]?.description).toBe("A skill with a colon: in the description");
	});

	test("trims whitespace from instructions", async () => {
		const skillsDir = join(capabilityPath, "skills", "whitespace-skill");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `---
name: whitespace-skill
description: Test whitespace trimming
---


Instructions with leading/trailing whitespace.

	`;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(1);
		expect(skills[0]?.instructions).toBe("Instructions with leading/trailing whitespace.");
	});

	test("throws error when SKILL.md has no frontmatter", async () => {
		const skillsDir = join(capabilityPath, "skills", "no-frontmatter");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `# Just Instructions

No frontmatter here.`;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		await expect(loadSkills(capabilityPath, "test-cap")).rejects.toThrow(
			/Invalid SKILL\.md format.*missing YAML frontmatter/,
		);
	});

	test("throws error when SKILL.md is missing name field", async () => {
		const skillsDir = join(capabilityPath, "skills", "missing-name");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `---
description: Missing name field
---

Instructions here.`;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		await expect(loadSkills(capabilityPath, "test-cap")).rejects.toThrow(
			/name and description required/,
		);
	});

	test("throws error when SKILL.md is missing description field", async () => {
		const skillsDir = join(capabilityPath, "skills", "missing-description");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `---
name: missing-description
---

Instructions here.`;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		await expect(loadSkills(capabilityPath, "test-cap")).rejects.toThrow(
			/name and description required/,
		);
	});

	test("handles empty instructions after frontmatter", async () => {
		const skillsDir = join(capabilityPath, "skills", "empty-instructions");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `---
name: empty-instructions
description: Skill with no instructions
---
`;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(1);
		expect(skills[0]?.instructions).toBe("");
	});

	test("preserves markdown formatting in instructions", async () => {
		const skillsDir = join(capabilityPath, "skills", "markdown-skill");
		mkdirSync(skillsDir, { recursive: true });

		const skillContent = `---
name: markdown-skill
description: Skill with markdown
---

# Header

- List item 1
- List item 2

**Bold text** and *italic text*.

\`\`\`typescript
const code = "example";
\`\`\``;

		writeFileSync(join(skillsDir, "SKILL.md"), skillContent);

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(1);
		expect(skills[0]?.instructions).toContain("# Header");
		expect(skills[0]?.instructions).toContain("- List item 1");
		expect(skills[0]?.instructions).toContain("**Bold text**");
		expect(skills[0]?.instructions).toContain("```typescript");
	});

	test("ignores non-directory entries in skills folder", async () => {
		const skillsDir = join(capabilityPath, "skills");
		const validSkillDir = join(skillsDir, "valid-skill");
		mkdirSync(validSkillDir, { recursive: true });

		writeFileSync(
			join(validSkillDir, "SKILL.md"),
			`---
name: valid-skill
description: Valid skill
---

Valid instructions.`,
		);

		// Create a file directly in skills/ directory (should be ignored)
		writeFileSync(join(skillsDir, "README.md"), "This should be ignored");

		const skills = await loadSkills(capabilityPath, "test-cap");

		expect(skills).toHaveLength(1);
		expect(skills[0]?.name).toBe("valid-skill");
	});

	test("associates skills with correct capability ID", async () => {
		const skillsDir = join(capabilityPath, "skills", "test-skill");
		mkdirSync(skillsDir, { recursive: true });

		writeFileSync(
			join(skillsDir, "SKILL.md"),
			`---
name: test-skill
description: Test skill
---

Instructions.`,
		);

		const skills = await loadSkills(capabilityPath, "my-capability");

		expect(skills).toHaveLength(1);
		expect(skills[0]?.capabilityId).toBe("my-capability");
	});
});
