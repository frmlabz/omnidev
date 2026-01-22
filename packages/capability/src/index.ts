/**
 * @omnidev-ai/capability - Capability Development Kit for OmniDev
 *
 * This package provides types and utilities for building OmniDev capabilities.
 * Capabilities should depend on this package (not @omnidev-ai/core) for:
 * - CLI command definitions
 * - Capability export types
 * - Builder functions
 */

// Export builder functions
export { command, routes } from "./builders.js";

// Export all types
export * from "./types/index.js";
