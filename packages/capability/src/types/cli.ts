/**
 * OmniDev CLI Type Definitions
 *
 * These types define the structure for capability CLI commands.
 * They are OmniDev-native and don't depend on @stricli/core.
 * The main CLI transforms these into Stricli commands at load time.
 */

/**
 * Flag types supported by capability commands.
 */
export type CapabilityFlagKind = "boolean" | "string" | "number" | "enum";

/**
 * Flag definition for a capability command.
 *
 * @example
 * ```typescript
 * const verboseFlag: CapabilityFlag = {
 *   brief: "Show verbose output",
 *   kind: "boolean",
 *   optional: true,
 * };
 *
 * const formatFlag: CapabilityFlag = {
 *   brief: "Output format",
 *   kind: "enum",
 *   values: ["json", "yaml", "text"],
 *   default: "text",
 * };
 * ```
 */
export interface CapabilityFlag {
	/** Short description of the flag */
	brief: string;

	/** The type of value this flag accepts */
	kind: CapabilityFlagKind;

	/** Whether this flag is optional (default: false) */
	optional?: boolean;

	/** For enum kind: the allowed values */
	values?: string[];

	/** Default value for the flag */
	default?: unknown;

	/** Single-character alias (e.g., "v" for --verbose) */
	alias?: string;

	/** Whether this flag can be specified multiple times */
	variadic?: boolean;
}

/**
 * Positional parameter types supported by capability commands.
 */
export type CapabilityPositionalKind = "string" | "number" | "enum";

/**
 * Positional parameter definition for a capability command.
 *
 * @example
 * ```typescript
 * const filePositional: CapabilityPositional = {
 *   brief: "File to process",
 *   kind: "string",
 * };
 *
 * const levelPositional: CapabilityPositional = {
 *   brief: "Log level",
 *   kind: "enum",
 *   values: ["debug", "info", "warn", "error"],
 * };
 * ```
 */
export interface CapabilityPositional {
	/** Short description of the positional parameter */
	brief: string;

	/** The type of value this positional accepts */
	kind: CapabilityPositionalKind;

	/** Whether this positional is optional */
	optional?: boolean;

	/** For enum kind: the allowed values */
	values?: string[];
}

/**
 * Command parameter configuration.
 *
 * @example
 * ```typescript
 * const params: CapabilityParameters = {
 *   flags: {
 *     verbose: { brief: "Verbose output", kind: "boolean", optional: true },
 *     output: { brief: "Output file", kind: "string", alias: "o" },
 *   },
 *   positional: [
 *     { brief: "Input file", kind: "string" },
 *   ],
 *   aliases: {
 *     v: "verbose",
 *   },
 * };
 * ```
 */
export interface CapabilityParameters {
	/** Named flags (--flag-name) */
	flags?: Record<string, CapabilityFlag>;

	/** Positional arguments */
	positional?: CapabilityPositional[];

	/** Flag aliases (short to long name mapping) */
	aliases?: Record<string, string>;
}

/**
 * Command function signature.
 * Receives parsed flags and positional arguments.
 */
export type CapabilityCommandFunc = (
	flags: Record<string, unknown>,
	...args: unknown[]
) => Promise<void>;

/**
 * Complete command definition.
 *
 * @example
 * ```typescript
 * const statusCommand: CapabilityCommand = {
 *   brief: "Show project status",
 *   fullDescription: "Displays the current status of the project including...",
 *   parameters: {
 *     flags: {
 *       verbose: { brief: "Show details", kind: "boolean", optional: true },
 *     },
 *   },
 *   async func(flags) {
 *     console.log("Status: OK");
 *     if (flags.verbose) {
 *       console.log("Details: ...");
 *     }
 *   },
 * };
 * ```
 */
export interface CapabilityCommand {
	/** Short description shown in help listings */
	brief: string;

	/** Full description shown in command-specific help */
	fullDescription?: string;

	/** Parameter configuration */
	parameters?: CapabilityParameters;

	/** The function to execute when this command is invoked */
	func: CapabilityCommandFunc;
}

/**
 * Route map for grouping related commands.
 *
 * @example
 * ```typescript
 * const capabilityRoutes: CapabilityRouteMap = {
 *   brief: "Manage capabilities",
 *   routes: {
 *     list: listCommand,
 *     enable: enableCommand,
 *     disable: disableCommand,
 *   },
 * };
 * ```
 */
export interface CapabilityRouteMap {
	/** Short description of this command group */
	brief: string;

	/** Nested commands or route maps */
	routes: Record<string, CapabilityCommand | CapabilityRouteMap>;
}

/**
 * Union type for any route entry (command or route map).
 */
export type CapabilityRoute = CapabilityCommand | CapabilityRouteMap;

/**
 * Type guard to check if a route is a command.
 */
export function isCapabilityCommand(route: unknown): route is CapabilityCommand {
	if (!route || typeof route !== "object") {
		return false;
	}
	const obj = route as Record<string, unknown>;
	// A command has a 'func' property and 'brief' but no 'routes'
	return (
		typeof obj["func"] === "function" && typeof obj["brief"] === "string" && !("routes" in obj)
	);
}

/**
 * Type guard to check if a route is a route map.
 */
export function isCapabilityRouteMap(route: unknown): route is CapabilityRouteMap {
	if (!route || typeof route !== "object") {
		return false;
	}
	const obj = route as Record<string, unknown>;
	// A route map has 'routes' and 'brief' but no 'func'
	return (
		typeof obj["routes"] === "object" &&
		obj["routes"] !== null &&
		typeof obj["brief"] === "string" &&
		!("func" in obj)
	);
}
