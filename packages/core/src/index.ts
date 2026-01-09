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

// Export core types
export * from "./types";

// Export config functionality
export * from "./config";

// Export test utilities
export * from "./test-utils";

// Export capability system
export * from "./capability";

// Export templates
export * from "./templates/agents";
export * from "./templates/claude";

// Export gitignore management
export * from "./gitignore/manager";
