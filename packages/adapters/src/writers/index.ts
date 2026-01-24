/**
 * File writers for OmniDev adapters.
 *
 * Writers are stateless handlers that write specific types of content to disk.
 * They are used by adapters to materialize sync bundles into provider-specific
 * file structures.
 */

// Types
export type { AdapterWriterConfig, FileWriter, WriterContext, WriterResult } from "./types.js";

// Writers
export { ClaudeAgentsWriter } from "./claude-agents.js";
export { ClaudeCommandsAsSkillsWriter } from "./claude-commands-as-skills.js";
export { CodexTomlWriter } from "./codex-toml.js";
export { CursorRulesWriter } from "./cursor-rules.js";
export { HooksWriter } from "./hooks.js";
export { InstructionsMdWriter } from "./instructions-md.js";
export { OpenCodeAgentsWriter } from "./opencode-agents.js";
export { OpenCodeCommandsWriter } from "./opencode-commands.js";
export { SkillsWriter } from "./skills.js";

// Execution
export { executeWriters, type ExecuteWritersResult } from "./executor.js";
