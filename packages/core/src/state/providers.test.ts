import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { setupTestDir } from "@omnidev-ai/core/test-utils";
import {
	disableProvider,
	enableProvider,
	isProviderEnabled,
	readEnabledProviders,
	writeEnabledProviders,
} from "./providers";

describe("providers state", () => {
	setupTestDir("providers-test-", { chdir: true });

	describe("readEnabledProviders", () => {
		test("returns default providers when state file does not exist", async () => {
			const providers = await readEnabledProviders();
			expect(providers).toEqual(["claude-code"]);
		});

		test("reads providers from state file", async () => {
			await writeEnabledProviders(["cursor", "codex"]);
			const providers = await readEnabledProviders();
			expect(providers).toEqual(["cursor", "codex"]);
		});

		test("returns default when state file is empty", async () => {
			await writeEnabledProviders([]);
			const providers = await readEnabledProviders();
			expect(providers).toEqual(["claude-code"]);
		});
	});

	describe("writeEnabledProviders", () => {
		test("creates state directory and writes providers", async () => {
			await writeEnabledProviders(["claude-code", "cursor"]);
			expect(existsSync(".omni/state/providers.json")).toBe(true);

			const providers = await readEnabledProviders();
			expect(providers).toEqual(["claude-code", "cursor"]);
		});

		test("overwrites existing providers", async () => {
			await writeEnabledProviders(["claude-code"]);
			await writeEnabledProviders(["cursor", "codex"]);

			const providers = await readEnabledProviders();
			expect(providers).toEqual(["cursor", "codex"]);
		});
	});

	describe("enableProvider", () => {
		test("adds provider to enabled list", async () => {
			await writeEnabledProviders(["claude-code"]);
			await enableProvider("cursor");

			const providers = await readEnabledProviders();
			expect(providers).toContain("claude-code");
			expect(providers).toContain("cursor");
		});

		test("does not duplicate provider if already enabled", async () => {
			await writeEnabledProviders(["claude-code", "cursor"]);
			await enableProvider("cursor");

			const providers = await readEnabledProviders();
			expect(providers.filter((p) => p === "cursor").length).toBe(1);
		});
	});

	describe("disableProvider", () => {
		test("removes provider from enabled list", async () => {
			await writeEnabledProviders(["claude-code", "cursor"]);
			await disableProvider("cursor");

			const providers = await readEnabledProviders();
			expect(providers).toEqual(["claude-code"]);
		});

		test("handles disabling non-existent provider gracefully", async () => {
			await writeEnabledProviders(["claude-code"]);
			await disableProvider("cursor");

			const providers = await readEnabledProviders();
			expect(providers).toEqual(["claude-code"]);
		});
	});

	describe("isProviderEnabled", () => {
		test("returns true when provider is enabled", async () => {
			await writeEnabledProviders(["claude-code", "cursor"]);

			expect(await isProviderEnabled("cursor")).toBe(true);
		});

		test("returns false when provider is not enabled", async () => {
			await writeEnabledProviders(["claude-code"]);

			expect(await isProviderEnabled("cursor")).toBe(false);
		});
	});

	describe("round-trip", () => {
		test("write then read returns same providers", async () => {
			const original = ["claude-code", "cursor", "codex"];
			await writeEnabledProviders(original);
			const loaded = await readEnabledProviders();
			expect(loaded).toEqual(original);
		});
	});
});
