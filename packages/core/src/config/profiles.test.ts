import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readActiveProfileState } from "../state/active-profile.js";
import type { OmniConfig } from "../types/index.js";
import { getActiveProfile, resolveEnabledCapabilities, setActiveProfile } from "./profiles.js";

describe("getActiveProfile", () => {
	const TEST_DIR = ".omni-test-profiles";
	let originalCwd: string;

	beforeEach(() => {
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}
		originalCwd = process.cwd();
		process.chdir(TEST_DIR);
		if (!existsSync(".omni")) {
			mkdirSync(".omni", { recursive: true });
		}
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	test("returns null when no state file or config exists", async () => {
		const profile = await getActiveProfile();
		expect(profile).toBe(null);
	});

	test("returns profile from state file when set", async () => {
		mkdirSync(".omni/state", { recursive: true });
		await Bun.write(".omni/state/active-profile", "dev");
		const profile = await getActiveProfile();
		expect(profile).toBe("dev");
	});

	test("falls back to config.toml for backwards compatibility", async () => {
		writeFileSync("omni.toml", 'active_profile = "legacy"', "utf-8");
		const profile = await getActiveProfile();
		expect(profile).toBe("legacy");
	});

	test("state file takes precedence over config.toml", async () => {
		mkdirSync(".omni/state", { recursive: true });
		await Bun.write(".omni/state/active-profile", "from-state");
		writeFileSync("omni.toml", 'active_profile = "from-config"', "utf-8");
		const profile = await getActiveProfile();
		expect(profile).toBe("from-state");
	});

	test("returns null when config has no active_profile", async () => {
		writeFileSync("omni.toml", 'project = "test"', "utf-8");
		const profile = await getActiveProfile();
		expect(profile).toBe(null);
	});
});

describe("setActiveProfile", () => {
	const TEST_DIR = ".omni-test-profiles-set";
	let originalCwd: string;

	beforeEach(() => {
		if (!existsSync(TEST_DIR)) {
			mkdirSync(TEST_DIR, { recursive: true });
		}
		originalCwd = process.cwd();
		process.chdir(TEST_DIR);
		if (!existsSync(".omni")) {
			mkdirSync(".omni", { recursive: true });
		}
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	test("sets active_profile in state file", async () => {
		await setActiveProfile("staging");
		const stateProfile = await readActiveProfileState();
		expect(stateProfile).toBe("staging");
	});

	test("overwrites existing active_profile in state file", async () => {
		mkdirSync(".omni/state", { recursive: true });
		await Bun.write(".omni/state/active-profile", "dev");
		await setActiveProfile("prod");
		const stateProfile = await readActiveProfileState();
		expect(stateProfile).toBe("prod");
	});

	test("does not modify config.toml", async () => {
		writeFileSync("omni.toml", 'project = "test"', "utf-8");
		await setActiveProfile("staging");
		const content = await Bun.file("omni.toml").text();
		expect(content).not.toContain("active_profile");
	});
});

describe("resolveEnabledCapabilities", () => {
	test("returns empty array when no profiles configured", () => {
		const config: OmniConfig = {};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual([]);
	});

	test("returns empty array when profile has no capabilities", () => {
		const config: OmniConfig = {
			profiles: {
				default: {
					capabilities: [],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual([]);
	});

	test("returns capabilities from specified profile", () => {
		const config: OmniConfig = {
			profiles: {
				dev: {
					capabilities: ["tasks", "filesystem", "debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["tasks", "filesystem", "debug"]);
	});

	test("uses active_profile when profileName is null", () => {
		const config: OmniConfig = {
			active_profile: "dev",
			profiles: {
				dev: {
					capabilities: ["tasks", "debug"],
				},
				default: {
					capabilities: ["tasks"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual(["tasks", "debug"]);
	});

	test('falls back to "default" profile when active_profile not set', () => {
		const config: OmniConfig = {
			profiles: {
				default: {
					capabilities: ["tasks", "filesystem"],
				},
				dev: {
					capabilities: ["tasks", "debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual(["tasks", "filesystem"]);
	});

	test("handles non-existent profile gracefully", () => {
		const config: OmniConfig = {
			profiles: {
				dev: {
					capabilities: ["debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "nonexistent");
		expect(result).toEqual([]);
	});

	test("handles config with no profiles defined", () => {
		const config: OmniConfig = {};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual([]);
	});

	test("handles profile with undefined capabilities field", () => {
		const config: OmniConfig = {
			profiles: {
				dev: {},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual([]);
	});

	test("includes always-enabled capabilities with profile capabilities", () => {
		const config: OmniConfig = {
			always_enabled_capabilities: ["logging", "telemetry"],
			profiles: {
				dev: {
					capabilities: ["tasks", "debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["logging", "telemetry", "tasks", "debug"]);
	});

	test("removes duplicates when capability is in both always-enabled and profile", () => {
		const config: OmniConfig = {
			always_enabled_capabilities: ["logging", "tasks"],
			profiles: {
				dev: {
					capabilities: ["tasks", "debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["logging", "tasks", "debug"]);
	});

	test("returns only always-enabled capabilities when profile has none", () => {
		const config: OmniConfig = {
			always_enabled_capabilities: ["logging", "telemetry"],
			profiles: {
				dev: {
					capabilities: [],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["logging", "telemetry"]);
	});

	test("returns always-enabled capabilities even when no profiles exist", () => {
		const config: OmniConfig = {
			always_enabled_capabilities: ["logging", "telemetry"],
		};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual(["logging", "telemetry"]);
	});

	test("always-enabled capabilities work with active_profile", () => {
		const config: OmniConfig = {
			active_profile: "dev",
			always_enabled_capabilities: ["logging"],
			profiles: {
				dev: {
					capabilities: ["tasks", "debug"],
				},
				default: {
					capabilities: ["tasks"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual(["logging", "tasks", "debug"]);
	});
});
