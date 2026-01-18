/**
 * @omnidev-ai/core - Core functionality for OmniDev
 *
 * This package contains shared types, utilities, and core logic
 * used across the CLI and capability tooling packages.
 */

// Re-export @stricli/core for capabilities to use
// This ensures all capabilities use the same @stricli/core instance as the CLI
export { buildCommand, buildRouteMap } from "@stricli/core";

export const version = "0.1.0";

export function getVersion(): string {
	return version;
}

// Export capability system
export * from "./capability";

// Export config functionality
export * from "./config";
// Export MCP JSON management
export * from "./mcp-json";
// Export state management
export * from "./state";
// Export sync functionality
export * from "./sync";

// Export templates
export * from "./templates/agents";
export * from "./templates/claude";
export * from "./templates/omni";
// Export core types
export * from "./types";

// Export debug utilities
export * from "./debug";
