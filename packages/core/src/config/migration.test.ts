import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	getMigrationSummary,
	hasNewStructure,
	hasOldStructure,
	migrateStructure,
} from "./migration";

describe("migration", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		// Create a unique test directory
		testDir = join(
			process.cwd(),
			".test-tmp",
			`migration-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		);
		mkdirSync(testDir, { recursive: true });

		// Change to test directory
		originalCwd = process.cwd();
		process.chdir(testDir);
	});

	afterEach(() => {
		// Restore working directory
		process.chdir(originalCwd);

		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("hasOldStructure", () => {
		test("returns true when omni/ folder with config.toml exists", () => {
			mkdirSync("omni", { recursive: true });
			writeFileSync("omni/config.toml", "project = 'test'");

			expect(hasOldStructure()).toBe(true);
		});

		test("returns false when omni/ folder does not exist", () => {
			expect(hasOldStructure()).toBe(false);
		});

		test("returns false when omni/ exists but config.toml does not", () => {
			mkdirSync("omni", { recursive: true });

			expect(hasOldStructure()).toBe(false);
		});
	});

	describe("hasNewStructure", () => {
		test("returns true when .omni/ folder with config.toml exists", () => {
			mkdirSync(".omni", { recursive: true });
			writeFileSync(".omni/config.toml", "project = 'test'");

			expect(hasNewStructure()).toBe(true);
		});

		test("returns false when .omni/ folder does not exist", () => {
			expect(hasNewStructure()).toBe(false);
		});

		test("returns false when .omni/ exists but config.toml does not", () => {
			mkdirSync(".omni", { recursive: true });

			expect(hasNewStructure()).toBe(false);
		});
	});

	describe("getMigrationSummary", () => {
		test("includes config.toml when present", () => {
			mkdirSync("omni", { recursive: true });
			writeFileSync("omni/config.toml", "project = 'test'");

			const summary = getMigrationSummary();

			expect(summary.some((line) => line.includes("config.toml"))).toBe(true);
		});

		test("includes capabilities directory when present", () => {
			mkdirSync("omni/capabilities", { recursive: true });
			writeFileSync("omni/config.toml", "");

			const summary = getMigrationSummary();

			expect(summary.some((line) => line.includes("capabilities"))).toBe(true);
		});

		test("mentions creating new config files", () => {
			mkdirSync("omni", { recursive: true });
			writeFileSync("omni/config.toml", "");

			const summary = getMigrationSummary();

			expect(summary.some((line) => line.includes("Create new config files"))).toBe(true);
		});

		test("mentions removing old omni/ folder", () => {
			mkdirSync("omni", { recursive: true });
			writeFileSync("omni/config.toml", "");

			const summary = getMigrationSummary();

			expect(summary.some((line) => line.includes("Remove old omni/"))).toBe(true);
		});
	});

	describe("migrateStructure", () => {
		test("migrates config.toml to .omni/", async () => {
			mkdirSync("omni", { recursive: true });
			writeFileSync("omni/config.toml", "project = 'test'");

			await migrateStructure();

			expect(existsSync(".omni/config.toml")).toBe(true);
			expect(await Bun.file(".omni/config.toml").text()).toBe("project = 'test'");
		});

		test("migrates capabilities directory to .omni/", async () => {
			mkdirSync("omni/capabilities/my-cap", { recursive: true });
			writeFileSync("omni/config.toml", "");
			writeFileSync("omni/capabilities/my-cap/index.ts", "export {}");

			await migrateStructure();

			expect(existsSync(".omni/capabilities/my-cap/index.ts")).toBe(true);
			expect(await Bun.file(".omni/capabilities/my-cap/index.ts").text()).toBe("export {}");
		});

		test("migrates other files and directories", async () => {
			mkdirSync("omni/custom-dir", { recursive: true });
			writeFileSync("omni/config.toml", "");
			writeFileSync("omni/custom-file.txt", "content");
			writeFileSync("omni/custom-dir/file.txt", "nested");

			await migrateStructure();

			expect(existsSync(".omni/custom-file.txt")).toBe(true);
			expect(existsSync(".omni/custom-dir/file.txt")).toBe(true);
			expect(await Bun.file(".omni/custom-file.txt").text()).toBe("content");
			expect(await Bun.file(".omni/custom-dir/file.txt").text()).toBe("nested");
		});

		test("removes old omni/ folder after migration", async () => {
			mkdirSync("omni", { recursive: true });
			writeFileSync("omni/config.toml", "");

			await migrateStructure();

			expect(existsSync("omni")).toBe(false);
		});

		test("throws error if old structure does not exist", async () => {
			await expect(migrateStructure()).rejects.toThrow("No old omni/ structure found to migrate");
		});

		test("throws error if new structure already exists", async () => {
			mkdirSync("omni", { recursive: true });
			mkdirSync(".omni", { recursive: true });
			writeFileSync("omni/config.toml", "");
			writeFileSync(".omni/config.toml", "");

			await expect(migrateStructure()).rejects.toThrow("New .omni/ structure already exists");
		});
	});
});
