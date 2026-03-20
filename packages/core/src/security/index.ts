/**
 * Security scanning module for capability supply-chain safety
 *
 * Provides opt-in scanning for:
 * - Suspicious Unicode characters (bidi overrides, zero-width, control chars)
 * - Symlinks that escape capability directories
 * - Suspicious script patterns in hooks
 * - Commands hidden in HTML comments (prompt injection via invisible markup)
 * - Outbound network requests (data exfiltration, payload downloads)
 */

export * from "./scanner";
export * from "./types";
