/**
 * Security scanning types
 *
 * Base types (SecurityMode, ScanSettings, SecurityConfig) are defined in ../types/index.ts
 * and used in OmniConfig. This file contains additional types for the scanner implementation.
 */

import type { SecurityConfig, ScanSettings } from "#types/index";

// Re-export the base types from the main types file
export type { SecurityMode, ScanSettings, SecurityConfig } from "#types/index";

/**
 * Severity level for security findings
 */
export type FindingSeverity = "low" | "medium" | "high" | "critical";

/**
 * Types of security findings
 */
export type FindingType =
	| "unicode_bidi"
	| "unicode_zero_width"
	| "unicode_control"
	| "symlink_escape"
	| "symlink_absolute"
	| "suspicious_script"
	| "binary_file"
	| "hidden_command"
	| "network_request";

/**
 * A security finding (potential issue)
 */
export interface SecurityFinding {
	/** Type of finding */
	type: FindingType;
	/** Severity level */
	severity: FindingSeverity;
	/** File path relative to capability root */
	file: string;
	/** Line number (if applicable) */
	line?: number;
	/** Column number (if applicable) */
	column?: number;
	/** Human-readable description */
	message: string;
	/** Additional details (e.g., specific codepoints found) */
	details?: string;
}

/**
 * Result of scanning a capability
 */
export interface ScanResult {
	/** Capability ID */
	capabilityId: string;
	/** Capability path */
	path: string;
	/** List of findings */
	findings: SecurityFinding[];
	/** Whether the scan passed (no findings or mode=warn) */
	passed: boolean;
	/** Scan duration in milliseconds */
	duration: number;
}

/**
 * Overall scan summary
 */
export interface ScanSummary {
	/** Total capabilities scanned */
	totalCapabilities: number;
	/** Capabilities with findings */
	capabilitiesWithFindings: number;
	/** Total findings */
	totalFindings: number;
	/** Findings by type */
	findingsByType: Record<FindingType, number>;
	/** Findings by severity */
	findingsBySeverity: Record<FindingSeverity, number>;
	/** Individual scan results */
	results: ScanResult[];
	/** Whether all scans passed */
	allPassed: boolean;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: Required<SecurityConfig> = {
	mode: "off",
	trusted_sources: [],
	scan: {
		unicode: true,
		symlinks: true,
		scripts: true,
		binaries: false,
		hiddenCommands: true,
	},
};

/**
 * Default scan settings
 */
export const DEFAULT_SCAN_SETTINGS: Required<ScanSettings> = {
	unicode: true,
	symlinks: true,
	scripts: true,
	binaries: false,
	hiddenCommands: true,
};
