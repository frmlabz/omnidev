import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import type { CapabilityRegistry } from "@omnidev/core";
import { handleOmniExecute } from "./execute";

describe("handleOmniExecute", () => {
	let testDir: string;
	let originalCwd: string;

	const mockRegistry = {
		getAllCapabilities: () => [],
		getAllSkills: () => [],
		getAllRules: () => [],
		getAllDocs: () => [],
		getCapability: () => undefined,
	} as CapabilityRegistry;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = `/tmp/omnidev-execute-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);

		// Initialize git repo for diff tests
		Bun.spawnSync(["git", "init"], { cwd: testDir });
		Bun.spawnSync(["git", "config", "user.email", "test@test.com"], { cwd: testDir });
		Bun.spawnSync(["git", "config", "user.name", "Test User"], { cwd: testDir });
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("should throw error when code is missing", async () => {
		await expect(handleOmniExecute(mockRegistry, {})).rejects.toThrow("code is required");
	});

	test("should throw error when code is empty string", async () => {
		await expect(handleOmniExecute(mockRegistry, { code: "" })).rejects.toThrow("code is required");
	});

	test("should throw error when code does not export main function", async () => {
		await expect(handleOmniExecute(mockRegistry, { code: 'console.log("test");' })).rejects.toThrow(
			"Code must export a main function",
		);
	});

	test("should create sandbox directory", async () => {
		const code = 'export async function main(): Promise<number> { console.log("test"); return 0; }';
		await handleOmniExecute(mockRegistry, { code });

		expect(existsSync(".omni/sandbox")).toBe(true);
	});

	test("should write code to main.ts", async () => {
		const code = 'export async function main(): Promise<number> { console.log("test"); return 0; }';
		await handleOmniExecute(mockRegistry, { code });

		const writtenCode = await Bun.file(".omni/sandbox/main.ts").text();
		// The code should be written directly to main.ts
		expect(writtenCode).toContain(code);
	});

	test("should execute code and return stdout", async () => {
		const code =
			'export async function main(): Promise<number> { console.log("Hello from sandbox"); return 0; }';
		const result = await handleOmniExecute(mockRegistry, { code });

		expect(result.content).toHaveLength(1);
		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		expect(firstContent.type).toBe("text");

		const parsed = JSON.parse(firstContent.text);
		expect(parsed.stdout).toContain("Hello from sandbox");
		expect(parsed.exit_code).toBe(0);
	});

	test("should execute code and capture stderr", async () => {
		const code =
			'export async function main(): Promise<number> { console.error("Error message"); return 0; }';
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.stderr).toContain("Error message");
	});

	test("should return non-zero exit code on error", async () => {
		const code = 'export async function main(): Promise<number> { throw new Error("Test error"); }';
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.exit_code).toBe(1);
	});

	test("should return empty changed_files when no git changes", async () => {
		const code = 'export async function main(): Promise<number> { console.log("test"); return 0; }';
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.changed_files).toEqual([]);
		expect(parsed.diff_stat.files).toBe(0);
		expect(parsed.diff_stat.insertions).toBe(0);
		expect(parsed.diff_stat.deletions).toBe(0);
	});

	test("should detect changed files after code execution", async () => {
		// Create initial commit
		await Bun.write("test.txt", "initial");
		Bun.spawnSync(["git", "add", "test.txt"], { cwd: testDir });
		Bun.spawnSync(["git", "commit", "-m", "initial"], { cwd: testDir });

		// Code that modifies a file
		const code = `
export async function main(): Promise<number> {
	await Bun.write('test.txt', 'modified');
	return 0;
}`;
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.changed_files).toContain("test.txt");
		expect(parsed.diff_stat.files).toBe(1);
	});

	test("should track insertions in diff_stat", async () => {
		// Create initial commit
		await Bun.write("test.txt", "");
		Bun.spawnSync(["git", "add", "test.txt"], { cwd: testDir });
		Bun.spawnSync(["git", "commit", "-m", "initial"], { cwd: testDir });

		// Code that adds lines
		const code = `
export async function main(): Promise<number> {
	await Bun.write('test.txt', 'line1\\nline2\\nline3');
	return 0;
}`;
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.diff_stat.insertions).toBeGreaterThan(0);
	});

	test("should track deletions in diff_stat", async () => {
		// Create initial commit with content
		await Bun.write("test.txt", "line1\nline2\nline3");
		Bun.spawnSync(["git", "add", "test.txt"], { cwd: testDir });
		Bun.spawnSync(["git", "commit", "-m", "initial"], { cwd: testDir });

		// Code that removes content
		const code = `
export async function main(): Promise<number> {
	await Bun.write('test.txt', '');
	return 0;
}`;
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.diff_stat.deletions).toBeGreaterThan(0);
	});

	test("should handle code with TypeScript syntax", async () => {
		const code = `
export async function main(): Promise<number> {
	const value: string = "TypeScript";
	console.log(value);
	return 0;
}`;
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.stdout).toContain("TypeScript");
		expect(parsed.exit_code).toBe(0);
	});

	test("should handle multiline code", async () => {
		const code = `
export async function main(): Promise<number> {
	const a = 1;
	const b = 2;
	console.log(a + b);
	return 0;
}`;
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.stdout).toContain("3");
		expect(parsed.exit_code).toBe(0);
	});

	test("should handle async code", async () => {
		const code = `
export async function main(): Promise<number> {
	await new Promise(resolve => setTimeout(resolve, 10));
	console.log("done");
	return 0;
}`;
		const result = await handleOmniExecute(mockRegistry, { code });

		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.stdout).toContain("done");
		expect(parsed.exit_code).toBe(0);
	});

	test("should return response in correct format", async () => {
		const code = 'export async function main(): Promise<number> { console.log("test"); return 0; }';
		const result = await handleOmniExecute(mockRegistry, { code });

		expect(result).toHaveProperty("content");
		expect(Array.isArray(result.content)).toBe(true);
		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		expect(firstContent.type).toBe("text");
		expect(firstContent).toHaveProperty("text");

		const parsed = JSON.parse(firstContent.text);
		expect(parsed).toHaveProperty("exit_code");
		expect(parsed).toHaveProperty("stdout");
		expect(parsed).toHaveProperty("stderr");
		expect(parsed).toHaveProperty("changed_files");
		expect(parsed).toHaveProperty("diff_stat");
		expect(parsed.diff_stat).toHaveProperty("files");
		expect(parsed.diff_stat).toHaveProperty("insertions");
		expect(parsed.diff_stat).toHaveProperty("deletions");
	});

	test("should handle code that creates files", async () => {
		// Create initial commit
		Bun.spawnSync(["git", "commit", "--allow-empty", "-m", "initial"], { cwd: testDir });

		const code = `
export async function main(): Promise<number> {
	await Bun.write('newfile.txt', 'content');
	return 0;
}`;
		const result = await handleOmniExecute(mockRegistry, { code });

		expect(existsSync("newfile.txt")).toBe(true);
		const firstContent = result.content[0];
		if (!firstContent) {
			throw new Error("No content in result");
		}
		const parsed = JSON.parse(firstContent.text);
		expect(parsed.exit_code).toBe(0);
	});

	test("should preserve working directory after execution", async () => {
		const code = 'export async function main(): Promise<number> { console.log("test"); return 0; }';
		await handleOmniExecute(mockRegistry, { code });

		expect(process.cwd()).toBe(testDir);
	});
});
