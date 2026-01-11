import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readdir, readlink } from "node:fs/promises";
import { join } from "node:path";
import type { LoadedCapability } from "@omnidev/core";
import { setupSandbox } from "./sandbox";

describe("sandbox", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		// Create a temporary test directory
		testDir = join("/tmp", `omnidev-sandbox-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalCwd = process.cwd();
		process.chdir(testDir);
	});

	afterEach(() => {
		// Restore original working directory
		process.chdir(originalCwd);

		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("creates sandbox directories", async () => {
		await setupSandbox([]);

		expect(existsSync(".omni/sandbox")).toBe(true);
		expect(existsSync(".omni/sandbox/node_modules")).toBe(true);
	});

	test("creates symlink for single capability", async () => {
		// Create a mock capability directory
		const capPath = "omni/capabilities/test-cap";
		mkdirSync(join(testDir, capPath), { recursive: true });
		writeFileSync(join(testDir, capPath, "index.ts"), "export {}");

		const cap: LoadedCapability = {
			id: "test-cap",
			path: capPath,
			config: {
				capability: {
					id: "test-cap",
					name: "Test Capability",
					version: "1.0.0",
					description: "Test capability",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		await setupSandbox([cap]);

		const linkPath = ".omni/sandbox/node_modules/test-cap";
		expect(existsSync(linkPath)).toBe(true);

		// Verify it's a symlink
		const target = await readlink(linkPath);
		expect(target).toBe("../../../omni/capabilities/test-cap");
	});

	test("creates symlinks for multiple capabilities", async () => {
		// Create mock capability directories
		const cap1Path = "omni/capabilities/cap1";
		const cap2Path = "omni/capabilities/cap2";
		mkdirSync(join(testDir, cap1Path), { recursive: true });
		mkdirSync(join(testDir, cap2Path), { recursive: true });
		writeFileSync(join(testDir, cap1Path, "index.ts"), "export {}");
		writeFileSync(join(testDir, cap2Path, "index.ts"), "export {}");

		const capabilities: LoadedCapability[] = [
			{
				id: "cap1",
				path: cap1Path,
				config: {
					capability: {
						id: "cap1",
						name: "Capability 1",
						version: "1.0.0",
						description: "First capability",
					},
				},
				skills: [],
				rules: [],
				docs: [],
				typeDefinitions: "",
			},
			{
				id: "cap2",
				path: cap2Path,
				config: {
					capability: {
						id: "cap2",
						name: "Capability 2",
						version: "1.0.0",
						description: "Second capability",
					},
				},
				skills: [],
				rules: [],
				docs: [],
				typeDefinitions: "",
			},
		];

		await setupSandbox(capabilities);

		expect(existsSync(".omni/sandbox/node_modules/cap1")).toBe(true);
		expect(existsSync(".omni/sandbox/node_modules/cap2")).toBe(true);
	});

	test("uses custom module name from exports config", async () => {
		const capPath = "omni/capabilities/my-cap";
		mkdirSync(join(testDir, capPath), { recursive: true });
		writeFileSync(join(testDir, capPath, "index.ts"), "export {}");

		const cap: LoadedCapability = {
			id: "my-cap",
			path: capPath,
			config: {
				capability: {
					id: "my-cap",
					name: "My Capability",
					version: "1.0.0",
					description: "Custom module name",
				},
				exports: {
					module: "custom-module-name",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		await setupSandbox([cap]);

		const linkPath = ".omni/sandbox/node_modules/custom-module-name";
		expect(existsSync(linkPath)).toBe(true);

		const target = await readlink(linkPath);
		expect(target).toBe("../../../omni/capabilities/my-cap");
	});

	test("cleans existing symlinks before creating new ones", async () => {
		// Create initial setup
		const capPath = "omni/capabilities/cap1";
		mkdirSync(join(testDir, capPath), { recursive: true });
		writeFileSync(join(testDir, capPath, "index.ts"), "export {}");

		const cap1: LoadedCapability = {
			id: "cap1",
			path: capPath,
			config: {
				capability: {
					id: "cap1",
					name: "Capability 1",
					version: "1.0.0",
					description: "First capability",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		await setupSandbox([cap1]);

		// Verify initial symlink exists
		expect(existsSync(".omni/sandbox/node_modules/cap1")).toBe(true);

		// Create new capability and run setup again
		const cap2Path = "omni/capabilities/cap2";
		mkdirSync(join(testDir, cap2Path), { recursive: true });
		writeFileSync(join(testDir, cap2Path, "index.ts"), "export {}");

		const cap2: LoadedCapability = {
			id: "cap2",
			path: cap2Path,
			config: {
				capability: {
					id: "cap2",
					name: "Capability 2",
					version: "1.0.0",
					description: "Second capability",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		await setupSandbox([cap2]);

		// Old symlink should be removed
		expect(existsSync(".omni/sandbox/node_modules/cap1")).toBe(false);

		// New symlink should exist
		expect(existsSync(".omni/sandbox/node_modules/cap2")).toBe(true);
	});

	test("handles empty capabilities array", async () => {
		await setupSandbox([]);

		const entries = await readdir(".omni/sandbox/node_modules");
		expect(entries.length).toBe(0);
	});

	test("is idempotent - can be called multiple times", async () => {
		const capPath = "omni/capabilities/test-cap";
		mkdirSync(join(testDir, capPath), { recursive: true });
		writeFileSync(join(testDir, capPath, "index.ts"), "export {}");

		const cap: LoadedCapability = {
			id: "test-cap",
			path: capPath,
			config: {
				capability: {
					id: "test-cap",
					name: "Test Capability",
					version: "1.0.0",
					description: "Test capability",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		// Call setupSandbox twice
		await setupSandbox([cap]);
		await setupSandbox([cap]);

		// Should still work correctly
		const linkPath = ".omni/sandbox/node_modules/test-cap";
		expect(existsSync(linkPath)).toBe(true);

		const target = await readlink(linkPath);
		expect(target).toBe("../../../omni/capabilities/test-cap");
	});

	test("creates symlinks with correct relative paths from sandbox/node_modules", async () => {
		// This test verifies that the symlinks point to the correct location
		// relative to .omni/sandbox/node_modules/
		const capPath = "omni/capabilities/my-capability";
		mkdirSync(join(testDir, capPath), { recursive: true });
		writeFileSync(join(testDir, capPath, "index.ts"), "export const test = true;");

		const cap: LoadedCapability = {
			id: "my-capability",
			path: capPath,
			config: {
				capability: {
					id: "my-capability",
					name: "My Capability",
					version: "1.0.0",
					description: "Test",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		await setupSandbox([cap]);

		const linkPath = ".omni/sandbox/node_modules/my-capability";
		const target = await readlink(linkPath);

		// Verify the symlink target is correct
		expect(target).toBe("../../../omni/capabilities/my-capability");

		// Verify the symlink resolves correctly
		const indexPath = join(linkPath, "index.ts");
		expect(existsSync(indexPath)).toBe(true);
	});

	test("handles capability path with different depth", async () => {
		// Test that symlinks work regardless of capability path structure
		const capPath = "capabilities/nested/deep/test-cap";
		mkdirSync(join(testDir, capPath), { recursive: true });
		writeFileSync(join(testDir, capPath, "index.ts"), "export {}");

		const cap: LoadedCapability = {
			id: "test-cap",
			path: capPath,
			config: {
				capability: {
					id: "test-cap",
					name: "Test Capability",
					version: "1.0.0",
					description: "Test capability",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		await setupSandbox([cap]);

		const linkPath = ".omni/sandbox/node_modules/test-cap";
		expect(existsSync(linkPath)).toBe(true);

		const target = await readlink(linkPath);
		expect(target).toBe("../../../capabilities/nested/deep/test-cap");
	});

	test("handles symlink creation error gracefully", async () => {
		// Create a capability with invalid path
		const cap: LoadedCapability = {
			id: "invalid-cap",
			path: "non-existent-path",
			config: {
				capability: {
					id: "invalid-cap",
					name: "Invalid Capability",
					version: "1.0.0",
					description: "This capability does not exist",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		// Should not throw, but log error to console
		await expect(setupSandbox([cap])).resolves.toBeUndefined();

		// The symlink might be created but won't resolve to a valid directory
		// This is expected behavior - the function continues gracefully
	});

	test("removes regular files in node_modules during cleanup", async () => {
		// Create sandbox directory with a regular file (not a symlink)
		mkdirSync(".omni/sandbox/node_modules", { recursive: true });
		writeFileSync(".omni/sandbox/node_modules/regular-file.txt", "test content");

		const capPath = "omni/capabilities/test-cap";
		mkdirSync(join(testDir, capPath), { recursive: true });
		writeFileSync(join(testDir, capPath, "index.ts"), "export {}");

		const cap: LoadedCapability = {
			id: "test-cap",
			path: capPath,
			config: {
				capability: {
					id: "test-cap",
					name: "Test Capability",
					version: "1.0.0",
					description: "Test capability",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		await setupSandbox([cap]);

		// Regular file should be removed
		expect(existsSync(".omni/sandbox/node_modules/regular-file.txt")).toBe(false);

		// New symlink should exist
		expect(existsSync(".omni/sandbox/node_modules/test-cap")).toBe(true);
	});

	test("removes nested directories in node_modules during cleanup", async () => {
		// Create sandbox directory with nested directory
		mkdirSync(".omni/sandbox/node_modules/old-dir/nested", { recursive: true });
		writeFileSync(".omni/sandbox/node_modules/old-dir/nested/file.txt", "test");

		const capPath = "omni/capabilities/test-cap";
		mkdirSync(join(testDir, capPath), { recursive: true });
		writeFileSync(join(testDir, capPath, "index.ts"), "export {}");

		const cap: LoadedCapability = {
			id: "test-cap",
			path: capPath,
			config: {
				capability: {
					id: "test-cap",
					name: "Test Capability",
					version: "1.0.0",
					description: "Test capability",
				},
			},
			skills: [],
			rules: [],
			docs: [],
			typeDefinitions: "",
		};

		await setupSandbox([cap]);

		// Old directory should be removed
		expect(existsSync(".omni/sandbox/node_modules/old-dir")).toBe(false);

		// New symlink should exist
		expect(existsSync(".omni/sandbox/node_modules/test-cap")).toBe(true);
	});
});
