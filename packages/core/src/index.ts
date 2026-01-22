/**
 * @omnidev-ai/core - Core functionality for OmniDev
 *
 * This package contains shared types, utilities, and core logic
 * used across the CLI and capability tooling packages.
 *
 * NOTE: For capability development, use @omnidev-ai/capability instead.
 * It provides command(), routes(), and CapabilityExport types.
 */

export const version = "0.1.0";

export function getVersion(): string {
	return version;
}

// Export capability system
export * from "./capability";

// Export hooks system
export * from "./hooks";

// Export config functionality
export * from "./config";
// Export MCP JSON management
export * from "./mcp-json";
// Export state management
export * from "./state";
// Export sync functionality
export * from "./sync";

// Export security scanning
export * from "./security";

// Export templates
export * from "./templates/agents";
export * from "./templates/capability";
export * from "./templates/claude";
export * from "./templates/omni";
// Export core types
export * from "./types";

// Export debug utilities
export * from "./debug";
