import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDocs } from "./docs";

describe("loadDocs", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(process.cwd(), "test-capability-docs");
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (testDir) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("returns empty array when no docs exist", async () => {
		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toEqual([]);
	});

	test("loads only definition.md when docs directory does not exist", async () => {
		writeFileSync(join(testDir, "definition.md"), "# Test Capability\n\nThis is the definition.");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(1);
		expect(docs[0]?.name).toBe("definition");
		expect(docs[0]?.content).toBe("# Test Capability\n\nThis is the definition.");
		expect(docs[0]?.capabilityId).toBe("test-cap");
	});

	test("loads only docs from docs directory when definition.md does not exist", async () => {
		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		writeFileSync(join(docsDir, "guide.md"), "# Guide\n\nGuide content.");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(1);
		expect(docs[0]?.name).toBe("guide");
		expect(docs[0]?.content).toBe("# Guide\n\nGuide content.");
		expect(docs[0]?.capabilityId).toBe("test-cap");
	});

	test("loads both definition.md and docs from docs directory", async () => {
		writeFileSync(join(testDir, "definition.md"), "# Definition");

		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		writeFileSync(join(docsDir, "guide.md"), "# Guide");
		writeFileSync(join(docsDir, "examples.md"), "# Examples");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(3);

		const names = docs.map((d) => d.name).sort();
		expect(names).toEqual(["definition", "examples", "guide"]);
	});

	test("trims whitespace from doc content", async () => {
		writeFileSync(join(testDir, "definition.md"), "\n\n  # Definition\n\nContent.\n\n  ");

		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		writeFileSync(join(docsDir, "guide.md"), "  \n# Guide\n\nGuide content.\n  ");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(2);
		expect(docs[0]?.content).toBe("# Definition\n\nContent.");
		expect(docs[1]?.content).toBe("# Guide\n\nGuide content.");
	});

	test("ignores non-markdown files in docs directory", async () => {
		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		writeFileSync(join(docsDir, "guide.md"), "# Guide");
		writeFileSync(join(docsDir, "readme.txt"), "Not markdown");
		writeFileSync(join(docsDir, "config.json"), "{}");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(1);
		expect(docs[0]?.name).toBe("guide");
	});

	test("ignores directories in docs directory", async () => {
		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		mkdirSync(join(docsDir, "subdir"));
		writeFileSync(join(docsDir, "guide.md"), "# Guide");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(1);
		expect(docs[0]?.name).toBe("guide");
	});

	test("handles docs with complex markdown formatting", async () => {
		const complexMarkdown = `# Complex Documentation

## Section 1

- List item 1
- List item 2

### Subsection

\`\`\`typescript
const code = "example";
\`\`\`

**Bold text** and *italic text*.

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;

		writeFileSync(join(testDir, "definition.md"), complexMarkdown);

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(1);
		expect(docs[0]?.content).toBe(complexMarkdown);
	});

	test("handles empty doc files", async () => {
		writeFileSync(join(testDir, "definition.md"), "");

		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		writeFileSync(join(docsDir, "guide.md"), "");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(2);
		expect(docs[0]?.content).toBe("");
		expect(docs[1]?.content).toBe("");
	});

	test("handles docs with only whitespace", async () => {
		writeFileSync(join(testDir, "definition.md"), "   \n\n   ");

		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		writeFileSync(join(docsDir, "guide.md"), "\n\n\n");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(2);
		expect(docs[0]?.content).toBe("");
		expect(docs[1]?.content).toBe("");
	});

	test("handles doc names with hyphens and underscores", async () => {
		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		writeFileSync(join(docsDir, "api-reference.md"), "Content");
		writeFileSync(join(docsDir, "getting_started.md"), "Content");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(2);

		const names = docs.map((d) => d.name).sort();
		expect(names).toEqual(["api-reference", "getting_started"]);
	});

	test("loads multiple docs in consistent order", async () => {
		writeFileSync(join(testDir, "definition.md"), "Definition");

		const docsDir = join(testDir, "docs");
		mkdirSync(docsDir);
		writeFileSync(join(docsDir, "aaa.md"), "AAA");
		writeFileSync(join(docsDir, "zzz.md"), "ZZZ");
		writeFileSync(join(docsDir, "mmm.md"), "MMM");

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(4);

		// definition.md should be first, then docs in filesystem order
		expect(docs[0]?.name).toBe("definition");
		const docNames = docs.slice(1).map((d) => d.name);
		expect(docNames).toHaveLength(3);
		expect(docNames).toContain("aaa");
		expect(docNames).toContain("zzz");
		expect(docNames).toContain("mmm");
	});

	test("returns empty array when docs directory is empty", async () => {
		mkdirSync(join(testDir, "docs"));
		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toEqual([]);
	});

	test("handles very long doc content", async () => {
		const longContent = `# Long Document\n\n${"Content line.\n".repeat(1000)}`;
		writeFileSync(join(testDir, "definition.md"), longContent);

		const docs = await loadDocs(testDir, "test-cap");
		expect(docs).toHaveLength(1);
		expect(docs[0]?.content).toBe(longContent.trim());
	});
});
