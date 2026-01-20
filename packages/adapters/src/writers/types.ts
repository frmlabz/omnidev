import type { SyncBundle } from "@omnidev-ai/core";

/**
 * Context passed to file writers during sync execution.
 */
export interface WriterContext {
	/** The output path for this writer (file or directory) */
	outputPath: string;
	/** The project root directory */
	projectRoot: string;
}

/**
 * Result returned by a file writer after execution.
 */
export interface WriterResult {
	/** List of files written (relative to projectRoot) */
	filesWritten: string[];
}

/**
 * A file writer that handles writing a specific type of content to disk.
 *
 * Writers are stateless and identified by their `id`. The same writer class
 * can be used by multiple adapters with different output paths.
 *
 * Deduplication during sync is based on (writer.id + outputPath) - if two
 * adapters specify the same writer with the same output path, the writer
 * only executes once.
 */
export interface FileWriter {
	/** Unique identifier for this writer type (e.g., "instructions-md", "skills") */
	readonly id: string;

	/**
	 * Write content from the sync bundle to the specified output path.
	 *
	 * @param bundle - The sync bundle containing all capability content
	 * @param ctx - Writer context with output path and project root
	 * @returns Result containing list of files written
	 */
	write(bundle: SyncBundle, ctx: WriterContext): Promise<WriterResult>;
}

/**
 * Configuration for a writer within an adapter.
 */
export interface AdapterWriterConfig {
	/** The file writer to use */
	writer: FileWriter;
	/** The output path (relative to project root) */
	outputPath: string;
}
