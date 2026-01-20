/**
 * @omnidev-ai/adapters - Provider adapters for OmniDev
 *
 * This package contains adapters that materialize OmniDev's provider-agnostic
 * SyncBundle into provider-specific file structures and configurations.
 */

// Export all adapters
export { claudeCodeAdapter } from "./claude-code/index.js";
export { codexAdapter } from "./codex/index.js";
export { cursorAdapter } from "./cursor/index.js";
export { opencodeAdapter } from "./opencode/index.js";

// Export adapter utilities
export {
	getAdapter,
	getAllAdapters,
	getEnabledAdapters,
	type AdapterRegistry,
} from "./registry.js";

// Export sync with writers
export {
	syncAdaptersWithWriters,
	type AdapterWithWriters,
	type SyncAdaptersResult,
} from "./sync.js";

// Export writers
export {
	// Types
	type AdapterWriterConfig,
	type FileWriter,
	type WriterContext,
	type WriterResult,
	type ExecuteWritersResult,
	// Writers
	CursorRulesWriter,
	HooksWriter,
	InstructionsMdWriter,
	SkillsWriter,
	// Execution
	executeWriters,
} from "./writers/index.js";

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
