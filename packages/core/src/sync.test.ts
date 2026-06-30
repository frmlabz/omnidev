import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCapabilityInstallCommand, withCapabilityInstallLock } from "./sync";
import { setupTestDir } from "./test-utils/helpers";

const testDir = setupTestDir("sync-test-");

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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

describe("withCapabilityInstallLock", () => {
	test("serializes concurrent work for the same capability", async () => {
		const capabilityPath = join(testDir.path, "locks", "capability");
		mkdirSync(capabilityPath, { recursive: true });

		const events: string[] = [];

		const first = withCapabilityInstallLock(
			capabilityPath,
			async () => {
				events.push("first:start");
				await wait(30);
				events.push("first:end");
			},
			{ retryMs: 1 },
		);

		await wait(5);

		const second = withCapabilityInstallLock(
			capabilityPath,
			async () => {
				events.push("second");
			},
			{ retryMs: 1 },
		);

		await Promise.all([first, second]);

		expect(events).toEqual(["first:start", "first:end", "second"]);
	});

	test("removes stale locks whose owner process has exited", async () => {
		const capabilityPath = join(testDir.path, "stale-locks", ".omni", "capabilities", "capability");
		const lockPath = join(
			testDir.path,
			"stale-locks",
			".omni",
			".locks",
			"capability.install.lock",
		);
		mkdirSync(lockPath, { recursive: true });
		writeFileSync(join(lockPath, "owner.json"), JSON.stringify({ pid: 999_999_999 }));

		await withCapabilityInstallLock(capabilityPath, async () => undefined, { retryMs: 1 });

		expect(existsSync(lockPath)).toBe(false);
	});
});
