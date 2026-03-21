import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCapabilityInstallCommand } from "./sync";
import { setupTestDir } from "./test-utils/helpers";

const testDir = setupTestDir("sync-test-");

describe("resolveCapabilityInstallCommand", () => {
	test("prefers npm ci when a package-lock.json is present", () => {
		const capabilityPath = join(testDir.path, "capability");
		mkdirSync(capabilityPath, { recursive: true });
		writeFileSync(join(capabilityPath, "package.json"), JSON.stringify({ name: "test-cap" }));
		writeFileSync(join(capabilityPath, "package-lock.json"), "{}");

		const command = resolveCapabilityInstallCommand(capabilityPath, { hasNpm: true });

		expect(command).toEqual({ cmd: "npm", args: ["ci"] });
	});

	test("uses npm install when packageManager=npm is declared", () => {
		const capabilityPath = join(testDir.path, "capability");
		mkdirSync(capabilityPath, { recursive: true });
		writeFileSync(
			join(capabilityPath, "package.json"),
			JSON.stringify({ name: "test-cap", packageManager: "npm@10.9.4" }),
		);

		const command = resolveCapabilityInstallCommand(capabilityPath, { hasNpm: true });

		expect(command).toEqual({ cmd: "npm", args: ["install"] });
	});

	test("rejects capabilities that explicitly declare bun", () => {
		const capabilityPath = join(testDir.path, "capability");
		mkdirSync(capabilityPath, { recursive: true });
		writeFileSync(
			join(capabilityPath, "package.json"),
			JSON.stringify({ name: "test-cap", packageManager: "bun@1.3.5" }),
		);

		expect(() => resolveCapabilityInstallCommand(capabilityPath, { hasNpm: true })).toThrow(
			"only supports npm",
		);
	});

	test("uses npm install for plain package.json capabilities", () => {
		const capabilityPath = join(testDir.path, "capability");
		mkdirSync(capabilityPath, { recursive: true });
		writeFileSync(join(capabilityPath, "package.json"), JSON.stringify({ name: "test-cap" }));

		const command = resolveCapabilityInstallCommand(capabilityPath, { hasNpm: true });

		expect(command).toEqual({ cmd: "npm", args: ["install"] });
	});

	test("throws when npm is unavailable", () => {
		const capabilityPath = join(testDir.path, "capability");
		mkdirSync(capabilityPath, { recursive: true });
		writeFileSync(join(capabilityPath, "package.json"), JSON.stringify({ name: "test-cap" }));
		writeFileSync(join(capabilityPath, "package-lock.json"), "{}");

		expect(() => resolveCapabilityInstallCommand(capabilityPath, { hasNpm: false })).toThrow(
			"npm is not installed",
		);
	});
});
