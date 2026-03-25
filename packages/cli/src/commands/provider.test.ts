import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { captureConsole, setupTestDir } from "@omnidev-ai/core/test-utils";
import { runProviderList, runProviderEnable, runProviderDisable } from "./provider";

// Import the functions we need to test
async function getProviderFunctions() {
	const { readEnabledProviders, writeEnabledProviders } = await import("@omnidev-ai/core");
	return { readEnabledProviders, writeEnabledProviders };
}

describe("provider commands", () => {
	setupTestDir("provider-test-", { chdir: true });

	beforeEach(async () => {
		// Create basic OmniDev structure
		mkdirSync(".omni/state", { recursive: true });
		await writeFile("omni.toml", "", "utf-8");
	});

	describe("runProviderList", () => {
		test("lists all providers with status", async () => {
			const { writeEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code", "cursor"]);

			const { stdout } = await captureConsole(async () => {
				await runProviderList();
			});

			const output = stdout.join("\n");
			expect(output).toContain("Available providers:");
			expect(output).toContain("Claude Code");
			expect(output).toContain("Cursor");
			expect(output).toContain("Codex");
			expect(output).toContain("OpenCode");
		});

		test("shows enabled providers with marker", async () => {
			const { writeEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code"]);

			const { stdout } = await captureConsole(async () => {
				await runProviderList();
			});

			const output = stdout.join("\n");
			// Should have at least one enabled marker
			expect(output).toContain("●");
		});

		test("shows disabled providers with different marker", async () => {
			const { writeEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code"]);

			const { stdout } = await captureConsole(async () => {
				await runProviderList();
			});

			const output = stdout.join("\n");
			// Should have disabled markers for other providers
			expect(output).toContain("○");
		});
	});

	describe("runProviderEnable", () => {
		test("enables a provider", async () => {
			const { writeEnabledProviders, readEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code"]);

			await captureConsole(async () => {
				await runProviderEnable({}, "cursor");
			});

			const providers = await readEnabledProviders();
			expect(providers).toContain("cursor");
		});

		test("shows success message", async () => {
			const { writeEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code"]);

			const { stdout } = await captureConsole(async () => {
				await runProviderEnable({}, "cursor");
			});

			const output = stdout.join("\n");
			expect(output).toContain("✓ Enabled provider: Cursor");
		});

		test("asks the user to update .gitignore for missing provider entries", async () => {
			const { writeEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code"]);

			const { stdout } = await captureConsole(async () => {
				await runProviderEnable({}, "cursor");
			});

			const output = stdout.join("\n");
			expect(output).toContain("Also update your .gitignore");
			expect(output).toContain(".cursor/");
		});

		test("does not ask to update .gitignore when provider entries are already ignored", async () => {
			const { writeEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code"]);
			await writeFile(".gitignore", ".cursor/\n", "utf-8");

			const { stdout } = await captureConsole(async () => {
				await runProviderEnable({}, "cursor");
			});

			const output = stdout.join("\n");
			expect(output).not.toContain("Also update your .gitignore");
		});
	});

	describe("runProviderDisable", () => {
		test("disables a provider", async () => {
			const { writeEnabledProviders, readEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code", "cursor"]);

			await captureConsole(async () => {
				await runProviderDisable({}, "cursor");
			});

			const providers = await readEnabledProviders();
			expect(providers).not.toContain("cursor");
		});

		test("shows success message", async () => {
			const { writeEnabledProviders } = await getProviderFunctions();
			await writeEnabledProviders(["claude-code", "cursor"]);

			const { stdout } = await captureConsole(async () => {
				await runProviderDisable({}, "cursor");
			});

			const output = stdout.join("\n");
			expect(output).toContain("✓ Disabled provider: Cursor");
		});
	});
});
