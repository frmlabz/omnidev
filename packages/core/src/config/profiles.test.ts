import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import { readActiveProfileState } from "../state/active-profile.js";
import type { OmniConfig } from "../types/index.js";
import { getActiveProfile, resolveEnabledCapabilities, setActiveProfile } from "./profiles.js";

describe("getActiveProfile", () => {
	setupTestDir("profiles-test-", { chdir: true, createOmniDir: true });

	test("returns null when no state file or config exists", async () => {
		const profile = await getActiveProfile();
		expect(profile).toBe(null);
	});

	test("returns profile from state file when set", async () => {
		mkdirSync(".omni/state", { recursive: true });
		await writeFile(".omni/state/active-profile", "dev", "utf-8");
		const profile = await getActiveProfile();
		expect(profile).toBe("dev");
	});

	test("returns null when config has no active_profile", async () => {
		writeFileSync("omni.toml", "", "utf-8");
		const profile = await getActiveProfile();
		expect(profile).toBe(null);
	});
});

describe("setActiveProfile", () => {
	setupTestDir("profiles-set-test-", { chdir: true, createOmniDir: true });

	test("sets active_profile in state file", async () => {
		await setActiveProfile("staging");
		const stateProfile = await readActiveProfileState();
		expect(stateProfile).toBe("staging");
	});

	test("overwrites existing active_profile in state file", async () => {
		mkdirSync(".omni/state", { recursive: true });
		await writeFile(".omni/state/active-profile", "dev", "utf-8");
		await setActiveProfile("prod");
		const stateProfile = await readActiveProfileState();
		expect(stateProfile).toBe("prod");
	});

	test("does not modify config.toml", async () => {
		writeFileSync("omni.toml", "", "utf-8");
		await setActiveProfile("staging");
		const content = await readFile("omni.toml", "utf-8");
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

	test('uses "default" profile when profileName is null', () => {
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
			capabilities: {
				always_enabled: ["logging", "telemetry"],
			},
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
			capabilities: {
				always_enabled: ["logging", "tasks"],
			},
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
			capabilities: {
				always_enabled: ["logging", "telemetry"],
			},
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
			capabilities: {
				always_enabled: ["logging", "telemetry"],
			},
		};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual(["logging", "telemetry"]);
	});

	test("always-enabled capabilities work with default profile", () => {
		const config: OmniConfig = {
			capabilities: {
				always_enabled: ["logging"],
			},
			profiles: {
				default: {
					capabilities: ["tasks"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual(["logging", "tasks"]);
	});

	test("expands group reference to constituent capabilities", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					expo: ["expo-app-design", "expo-deployment", "upgrading-expo"],
				},
			},
			profiles: {
				mobile: {
					capabilities: ["group:expo"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "mobile");
		expect(result).toEqual(["expo-app-design", "expo-deployment", "upgrading-expo"]);
	});

	test("expands multiple groups in profile", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					expo: ["expo-app-design", "expo-deployment"],
					backend: ["cloudflare", "database-tools"],
				},
			},
			profiles: {
				fullstack: {
					capabilities: ["group:expo", "group:backend"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "fullstack");
		expect(result).toEqual(["expo-app-design", "expo-deployment", "cloudflare", "database-tools"]);
	});

	test("mixes group references with standalone capabilities", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					expo: ["expo-app-design", "expo-deployment"],
				},
			},
			profiles: {
				mobile: {
					capabilities: ["group:expo", "react-native-tools"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "mobile");
		expect(result).toEqual(["expo-app-design", "expo-deployment", "react-native-tools"]);
	});

	test("deduplicates when capability appears in group and directly", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					expo: ["expo-app-design", "expo-deployment"],
				},
			},
			profiles: {
				mobile: {
					capabilities: ["expo-app-design", "group:expo"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "mobile");
		expect(result).toEqual(["expo-app-design", "expo-deployment"]);
	});

	test("deduplicates when same capability appears in multiple groups", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					frontend: ["react", "typescript"],
					fullstack: ["react", "node", "typescript"],
				},
			},
			profiles: {
				dev: {
					capabilities: ["group:frontend", "group:fullstack"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["react", "typescript", "node"]);
	});

	test("warns and returns empty for unknown group", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					expo: ["expo-app-design"],
				},
			},
			profiles: {
				mobile: {
					capabilities: ["group:nonexistent", "other-cap"],
				},
			},
		};
		const originalWarn = console.warn;
		const warnings: string[] = [];
		console.warn = (msg: string) => warnings.push(msg);

		const result = resolveEnabledCapabilities(config, "mobile");

		console.warn = originalWarn;
		expect(result).toEqual(["other-cap"]);
		expect(warnings).toContain("Unknown capability group: nonexistent");
	});

	test("expands group references in always_enabled", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					core: ["logging", "telemetry"],
				},
				always_enabled: ["group:core"],
			},
			profiles: {
				dev: {
					capabilities: ["debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["logging", "telemetry", "debug"]);
	});

	test("deduplicates between always_enabled groups and profile groups", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					core: ["logging", "telemetry"],
					dev: ["debug", "logging"],
				},
				always_enabled: ["group:core"],
			},
			profiles: {
				dev: {
					capabilities: ["group:dev"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["logging", "telemetry", "debug"]);
	});

	test("handles empty group gracefully", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					empty: [],
				},
			},
			profiles: {
				test: {
					capabilities: ["group:empty", "other-cap"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "test");
		expect(result).toEqual(["other-cap"]);
	});

	test("handles config with groups but no profiles", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					expo: ["expo-app-design"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, null);
		expect(result).toEqual([]);
	});

	test("always_disabled removes capabilities from profile", () => {
		const config: OmniConfig = {
			capabilities: {
				always_disabled: ["debug", "telemetry"],
			},
			profiles: {
				dev: {
					capabilities: ["tasks", "debug", "logging"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["tasks", "logging"]);
	});

	test("always_disabled removes capabilities from always_enabled", () => {
		const config: OmniConfig = {
			capabilities: {
				always_enabled: ["logging", "telemetry", "debug"],
				always_disabled: ["telemetry"],
			},
			profiles: {
				dev: {
					capabilities: ["tasks"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["logging", "debug", "tasks"]);
	});

	test("always_disabled with group reference", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					noisy: ["telemetry", "analytics"],
				},
				always_disabled: ["group:noisy"],
			},
			profiles: {
				dev: {
					capabilities: ["tasks", "telemetry", "logging"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["tasks", "logging"]);
	});

	test("always_disabled removes capabilities from expanded groups in profile", () => {
		const config: OmniConfig = {
			capabilities: {
				groups: {
					expo: ["expo-app-design", "expo-deployment", "upgrading-expo"],
				},
				always_disabled: ["expo-deployment"],
			},
			profiles: {
				mobile: {
					capabilities: ["group:expo"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "mobile");
		expect(result).toEqual(["expo-app-design", "upgrading-expo"]);
	});

	test("always_disabled with empty array has no effect", () => {
		const config: OmniConfig = {
			capabilities: {
				always_disabled: [],
			},
			profiles: {
				dev: {
					capabilities: ["tasks", "debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["tasks", "debug"]);
	});

	test("always_disabled can remove all capabilities", () => {
		const config: OmniConfig = {
			capabilities: {
				always_disabled: ["tasks", "debug"],
			},
			profiles: {
				dev: {
					capabilities: ["tasks", "debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual([]);
	});

	test("always_disabled does not affect capabilities not in profile", () => {
		const config: OmniConfig = {
			capabilities: {
				always_disabled: ["nonexistent-cap"],
			},
			profiles: {
				dev: {
					capabilities: ["tasks", "debug"],
				},
			},
		};
		const result = resolveEnabledCapabilities(config, "dev");
		expect(result).toEqual(["tasks", "debug"]);
	});
});
