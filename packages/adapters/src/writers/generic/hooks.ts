import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { transformHooksConfig, type SyncBundle } from "@omnidev-ai/core";
import type { FileWriter, WriterContext, WriterResult } from "./types";
import { createManagedOutput } from "./managed-outputs";

/**
 * Writer for hooks configuration files.
 *
 * Writes hooks from the sync bundle to a settings.json file.
 * Used by claude-code (.claude/settings.json).
 */
export const HooksWriter: FileWriter = {
	id: "hooks",

	async write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult> {
		if (!bundle.hooks) {
			return { filesWritten: [] };
		}

		const claudeHooks = transformHooksConfig(bundle.hooks, "toClaude");

		const settingsPath = join(ctx.projectRoot, ctx.outputPath);

		// Ensure parent directory exists
		const parentDir = dirname(settingsPath);
		await mkdir(parentDir, { recursive: true });

		// Load existing settings if they exist
		let existingSettings: Record<string, unknown> = {};
		if (existsSync(settingsPath)) {
			try {
				const content = await readFile(settingsPath, "utf-8");
				existingSettings = JSON.parse(content);
			} catch {
				// If we can't parse existing settings, start fresh
				existingSettings = {};
			}
		}

		// Merge hooks into settings
		const newSettings = {
			...existingSettings,
			hooks: claudeHooks,
		};

		// Write settings.json
		await writeFile(settingsPath, `${JSON.stringify(newSettings, null, 2)}\n`, "utf-8");

		return {
			filesWritten: [ctx.outputPath],
			managedOutputs: [
				createManagedOutput(ctx.outputPath, this.id, JSON.stringify(claudeHooks), {
					cleanupStrategy: "remove-json-key",
					jsonKey: "hooks",
				}),
			],
		};
	},
};
