/**
 * Builder functions for capability CLI commands.
 *
 * These provide a clean API for defining commands and routes
 * without requiring direct use of the type definitions.
 */

import type { CapabilityCommand, CapabilityRouteMap } from "./types/cli.js";

/**
 * Create a capability command.
 *
 * @example
 * ```typescript
 * const statusCommand = command({
 *   brief: "Show project status",
 *   parameters: {
 *     flags: {
 *       verbose: { brief: "Show details", kind: "boolean", optional: true },
 *     },
 *   },
 *   async func(flags) {
 *     console.log("Status: OK");
 *   },
 * });
 * ```
 */
export function command(config: CapabilityCommand): CapabilityCommand {
	return config;
}

/**
 * Create a route map for grouping related commands.
 *
 * @example
 * ```typescript
 * const capabilityRoutes = routes({
 *   brief: "Manage capabilities",
 *   routes: {
 *     list: listCommand,
 *     enable: enableCommand,
 *     disable: disableCommand,
 *   },
 * });
 * ```
 */
export function routes(config: CapabilityRouteMap): CapabilityRouteMap {
	return config;
}
