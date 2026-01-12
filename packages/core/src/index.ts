/**
 * @omnidev/core - Core functionality for OmniDev
 *
 * This package contains shared types, utilities, and core logic
 * used across the CLI and MCP server packages.
 */

export const version = "0.1.0";

export function getVersion(): string {
	return version;
}

// Export capability system
export * from "./capability";

// Export config functionality
export * from "./config";
// Export gitignore management
export * from "./gitignore/manager";
// Export state management
export * from "./state";
// Export sync functionality
export * from "./sync";

// Export templates
export * from "./templates/agents";
export * from "./templates/claude";
// Export test utilities
export * from "./test-utils";
// Export core types
export * from "./types";
