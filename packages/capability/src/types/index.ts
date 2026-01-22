/**
 * Type definitions for @omnidev-ai/capability
 */

// CLI command types
export type {
	CapabilityFlag,
	CapabilityFlagKind,
	CapabilityPositional,
	CapabilityPositionalKind,
	CapabilityParameters,
	CapabilityCommand,
	CapabilityCommandFunc,
	CapabilityRouteMap,
	CapabilityRoute,
} from "./cli.js";

export { isCapabilityCommand, isCapabilityRouteMap } from "./cli.js";

// Capability export types
export type {
	FileContent,
	DocExport,
	SkillExport,
	SubagentExport,
	CommandExport,
	CapabilityExport,
} from "./exports.js";
