import { describe, expect, test } from "bun:test";
import { parseFrontmatterWithMarkdown, parseSimpleYamlFrontmatter } from "./yaml-parser";

describe("parseSimpleYamlFrontmatter", () => {
	test("parses plain key: value pairs", () => {
		const parsed = parseSimpleYamlFrontmatter<Record<string, string>>(
			"name: my-skill\ndescription: Does a thing",
		);

		expect(parsed.name).toBe("my-skill");
		expect(parsed.description).toBe("Does a thing");
	});

	test("strips surrounding quotes", () => {
		const parsed = parseSimpleYamlFrontmatter<Record<string, string>>(
			`double: "quoted value"\nsingle: 'quoted value'`,
		);

		expect(parsed.double).toBe("quoted value");
		expect(parsed.single).toBe("quoted value");
	});

	test("converts kebab-case keys to camelCase", () => {
		const parsed = parseSimpleYamlFrontmatter<Record<string, string>>("allowed-tools: Bash, Read");

		expect(parsed.allowedTools).toBe("Bash, Read");
	});

	test("skips comments and blank lines", () => {
		const parsed = parseSimpleYamlFrontmatter<Record<string, string>>(
			"# a comment\n\nname: my-skill",
		);

		expect(parsed.name).toBe("my-skill");
		expect(Object.keys(parsed)).toEqual(["name"]);
	});

	test("reads literal block scalars, preserving newlines", () => {
		const parsed = parseSimpleYamlFrontmatter<Record<string, string>>(
			["description: |", "  first line", "  second line", "name: my-skill"].join("\n"),
		);

		expect(parsed.description).toBe("first line\nsecond line");
		expect(parsed.name).toBe("my-skill");
	});

	test("folds folded block scalars onto one line", () => {
		const parsed = parseSimpleYamlFrontmatter<Record<string, string>>(
			["description: >", "  first line", "  second line", "", "  new paragraph"].join("\n"),
		);

		expect(parsed.description).toBe("first line second line\nnew paragraph");
	});

	test("does not treat colons inside a block scalar as new keys", () => {
		// Regression: a wrapped description containing `Use when: "..."` used to
		// register a bogus `Use when` key and truncate the description to "|".
		const parsed = parseSimpleYamlFrontmatter<Record<string, string>>(
			[
				"description: |",
				"  Generate images via an API.",
				'  Use when: "generate an image", "make a video".',
				"name: generate",
			].join("\n"),
		);

		expect(parsed.description).toBe(
			'Generate images via an API.\nUse when: "generate an image", "make a video".',
		);
		expect(Object.keys(parsed).sort()).toEqual(["description", "name"]);
	});

	test("honours strip and keep chomping indicators", () => {
		const stripped = parseSimpleYamlFrontmatter<Record<string, string>>(
			["description: |-", "  only line", "", ""].join("\n"),
		);
		const kept = parseSimpleYamlFrontmatter<Record<string, string>>(
			["description: |+", "  only line", "", ""].join("\n"),
		);

		expect(stripped.description).toBe("only line");
		expect(kept.description).toBe("only line\n\n");
	});

	test("ignores indented keys of nested structures", () => {
		const parsed = parseSimpleYamlFrontmatter<Record<string, string>>(
			["name: my-skill", "metadata:", "  nested: value"].join("\n"),
		);

		expect(parsed.name).toBe("my-skill");
		expect(parsed.nested).toBeUndefined();
	});
});

describe("parseFrontmatterWithMarkdown", () => {
	test("splits block-scalar frontmatter from markdown body", () => {
		const parsed = parseFrontmatterWithMarkdown<Record<string, string>>(
			["---", "name: my-skill", "description: |", "  line one", "  line two", "---", "# Body"].join(
				"\n",
			),
		);

		expect(parsed).not.toBeNull();
		expect(parsed?.frontmatter.name).toBe("my-skill");
		expect(parsed?.frontmatter.description).toBe("line one\nline two");
		expect(parsed?.markdown).toBe("# Body");
	});

	test("returns null without frontmatter", () => {
		expect(parseFrontmatterWithMarkdown("# Just markdown")).toBeNull();
	});
});
