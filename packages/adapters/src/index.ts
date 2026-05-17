/**
 * @omnidev-ai/adapters - Provider adapters for OmniDev
 *
 * This package contains adapters that materialize OmniDev's provider-agnostic
 * SyncBundle into provider-specific file structures and configurations.
 */

// Export all adapters
export { claudeCodeAdapter } from "./claude-code/index";
export { codexAdapter } from "./codex/index";
export { cursorAdapter } from "./cursor/index";
export { opencodeAdapter } from "./opencode/index";

// Export adapter utilities
export {
	getAdapter,
	getAllAdapters,
	getEnabledAdapters,
	getProviderGitignoreEntries,
	type AdapterRegistry,
} from "./registry";
export type { WriterBackedProviderAdapter } from "./types";

// Export sync with writers
export {
	syncAdaptersWithWriters,
	type AdapterWithWriters,
	type SyncAdaptersResult,
} from "./sync";

// Export writers
export {
	// Types
	type AdapterWriterConfig,
	type FileWriter,
	type WriterContext,
	type WriterResult,
	type ExecuteWritersResult,
	// Writers
	HooksWriter,
	InstructionsMdWriter,
	SkillsWriter,
	// Execution
	executeWriters,
} from "./writers/generic/index";
export { CursorRulesWriter } from "./writers/cursor/index";

// Re-export types from core for convenience
export type {
	ProviderAdapter,
	ProviderContext,
	ProviderInitResult,
	ProviderManifest,
	ProviderSyncResult,
	ProviderId,
	SyncBundle,
} from "@omnidev-ai/core";
