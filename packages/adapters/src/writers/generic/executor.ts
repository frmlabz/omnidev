import type { CanonicalProviderId, SyncBundle } from "@omnidev-ai/core";
import type { AdapterWriterConfig, WriterResult } from "./types";

/**
 * Result of executing all writers.
 */
export interface ExecuteWritersResult {
	/** All files written across all writers */
	filesWritten: string[];
	/** Number of writers that were deduplicated (skipped) */
	deduplicatedCount: number;
	/** Managed outputs emitted by executed writers */
	managedOutputs: import("@omnidev-ai/core").ManagedOutput[];
}

/**
 * Execute writers with deduplication.
 *
 * Collects all writer configs, deduplicates by (writer.id + outputPath),
 * and executes each unique writer once.
 *
 * @param writerConfigs - Array of writer configurations from all adapters
 * @param bundle - The sync bundle containing all capability content
 * @param projectRoot - The project root directory
 * @returns Result containing all files written and deduplication stats
 */
export async function executeWriters(
	writerConfigs: AdapterWriterConfig[],
	bundle: SyncBundle,
	projectRoot: string,
	providerId?: CanonicalProviderId,
): Promise<ExecuteWritersResult> {
	// Dedupe by (writer.id + outputPath)
	const seen = new Set<string>();
	const uniqueConfigs: AdapterWriterConfig[] = [];
	let deduplicatedCount = 0;

	for (const config of writerConfigs) {
		const key = `${config.writer.id}:${config.outputPath}`;
		if (seen.has(key)) {
			deduplicatedCount++;
			continue;
		}
		seen.add(key);
		uniqueConfigs.push(config);
	}

	// Execute each unique writer
	const allFilesWritten: string[] = [];
	const allManagedOutputs: import("@omnidev-ai/core").ManagedOutput[] = [];

	for (const config of uniqueConfigs) {
		const result: WriterResult = await config.writer.write(bundle, {
			outputPath: config.outputPath,
			projectRoot,
			...(providerId ? { providerId } : {}),
		});
		allFilesWritten.push(...result.filesWritten);
		allManagedOutputs.push(...(result.managedOutputs ?? []));
	}

	return {
		filesWritten: allFilesWritten,
		deduplicatedCount,
		managedOutputs: allManagedOutputs,
	};
}
