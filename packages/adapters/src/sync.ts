import type { ProviderContext, SyncBundle } from "@omnidev-ai/core";
import { executeWriters, type AdapterWriterConfig } from "./writers/index.js";

/**
 * Adapter with writers declaration.
 */
export interface AdapterWithWriters {
	id: string;
	displayName: string;
	writers: AdapterWriterConfig[];
}

/**
 * Result of syncing adapters with writers.
 */
export interface SyncAdaptersResult {
	/** All files written across all adapters */
	filesWritten: string[];
	/** Number of writers that were deduplicated (skipped due to same writer+path) */
	deduplicatedCount: number;
	/** Per-adapter breakdown (for logging) */
	perAdapter: Map<string, string[]>;
}

/**
 * Sync multiple adapters using the writer system with deduplication.
 *
 * This function collects writers from all adapters, deduplicates by
 * (writer.id + outputPath), and executes each unique writer once.
 *
 * Use this instead of calling adapter.sync() individually when you want
 * deduplication across adapters (e.g., when both codex and opencode want AGENTS.md).
 *
 * @param adapters - Adapters to sync (must have `writers` property)
 * @param bundle - The sync bundle containing all capability content
 * @param ctx - Provider context with projectRoot
 * @returns Result containing all files written and deduplication stats
 */
export async function syncAdaptersWithWriters(
	adapters: AdapterWithWriters[],
	bundle: SyncBundle,
	ctx: ProviderContext,
): Promise<SyncAdaptersResult> {
	if (adapters.length === 0) {
		return {
			filesWritten: [],
			deduplicatedCount: 0,
			perAdapter: new Map(),
		};
	}

	// Collect all writer configs from all adapters
	const allWriterConfigs: AdapterWriterConfig[] = [];
	const writerToAdapter = new Map<string, string>(); // key -> adapter id (for per-adapter tracking)

	for (const adapter of adapters) {
		for (const config of adapter.writers) {
			const key = `${config.writer.id}:${config.outputPath}`;
			allWriterConfigs.push(config);

			// Track which adapter first declared this writer (for per-adapter breakdown)
			if (!writerToAdapter.has(key)) {
				writerToAdapter.set(key, adapter.id);
			}
		}
	}

	// Execute with deduplication
	const result = await executeWriters(allWriterConfigs, bundle, ctx.projectRoot);

	// Build per-adapter breakdown (shows which files each adapter "contributed")
	const perAdapter = new Map<string, string[]>();
	for (const adapter of adapters) {
		perAdapter.set(adapter.id, []);
	}

	// Attribute files to the first adapter that declared each writer
	const seen = new Set<string>();
	for (const config of allWriterConfigs) {
		const key = `${config.writer.id}:${config.outputPath}`;
		if (seen.has(key)) continue;
		seen.add(key);

		const adapterId = writerToAdapter.get(key);
		if (adapterId) {
			// Find files that match this output path
			const matchingFiles = result.filesWritten.filter(
				(f: string) => f === config.outputPath || f.startsWith(config.outputPath),
			);
			const adapterFiles = perAdapter.get(adapterId) ?? [];
			adapterFiles.push(...matchingFiles);
			perAdapter.set(adapterId, adapterFiles);
		}
	}

	return {
		filesWritten: result.filesWritten,
		deduplicatedCount: result.deduplicatedCount,
		perAdapter,
	};
}
