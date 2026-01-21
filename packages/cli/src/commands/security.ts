/**
 * Security CLI commands
 *
 * Commands for managing security scanning and allows.
 */

import { existsSync } from "node:fs";
import {
	addSecurityAllow,
	buildCapabilityRegistry,
	formatScanResults,
	getAllSecurityAllows,
	readSecurityAllows,
	removeSecurityAllow,
	scanCapabilities,
	type FindingType,
	type ScanSummary,
} from "@omnidev-ai/core";
import { buildCommand, buildRouteMap } from "@stricli/core";

/**
 * Valid finding types for validation
 */
const VALID_FINDING_TYPES: FindingType[] = [
	"unicode_bidi",
	"unicode_zero_width",
	"unicode_control",
	"symlink_escape",
	"symlink_absolute",
	"suspicious_script",
	"binary_file",
];

/**
 * Check if a string is a valid finding type
 */
function isValidFindingType(type: string): type is FindingType {
	return VALID_FINDING_TYPES.includes(type as FindingType);
}

/**
 * Filter scan results to exclude allowed findings
 */
async function filterAllowedFindings(summary: ScanSummary): Promise<ScanSummary> {
	const state = await readSecurityAllows();

	// Create a new summary with filtered results
	const filteredResults = summary.results.map((result) => {
		const allows = state.allows[result.capabilityId] ?? [];
		const filteredFindings = result.findings.filter((finding) => !allows.includes(finding.type));

		return {
			...result,
			findings: filteredFindings,
			passed: filteredFindings.length === 0 || filteredFindings.every((f) => f.severity === "low"),
		};
	});

	// Recalculate summary stats
	const findingsByType: Record<FindingType, number> = {
		unicode_bidi: 0,
		unicode_zero_width: 0,
		unicode_control: 0,
		symlink_escape: 0,
		symlink_absolute: 0,
		suspicious_script: 0,
		binary_file: 0,
	};

	const findingsBySeverity: Record<string, number> = {
		low: 0,
		medium: 0,
		high: 0,
		critical: 0,
	};

	let totalFindings = 0;
	let capabilitiesWithFindings = 0;

	for (const result of filteredResults) {
		if (result.findings.length > 0) {
			capabilitiesWithFindings++;
		}
		for (const finding of result.findings) {
			totalFindings++;
			const currentTypeCount = findingsByType[finding.type] ?? 0;
			findingsByType[finding.type] = currentTypeCount + 1;
			const currentSeverityCount = findingsBySeverity[finding.severity] ?? 0;
			findingsBySeverity[finding.severity] = currentSeverityCount + 1;
		}
	}

	return {
		...summary,
		results: filteredResults,
		totalFindings,
		capabilitiesWithFindings,
		findingsByType,
		findingsBySeverity: findingsBySeverity as ScanSummary["findingsBySeverity"],
		allPassed: filteredResults.every((r) => r.passed),
	};
}

/**
 * Format findings with allow hints
 */
function formatFindingsWithHints(summary: ScanSummary): string {
	const lines: string[] = [];

	lines.push("Security Scan Results");
	lines.push("=====================");
	lines.push("");

	if (summary.totalFindings === 0) {
		lines.push("No security issues found");
		return lines.join("\n");
	}

	lines.push(
		`Found ${summary.totalFindings} issue(s) in ${summary.capabilitiesWithFindings} capability(ies)`,
	);
	lines.push("");

	// Show by severity
	if (summary.findingsBySeverity.critical > 0) {
		lines.push(`  CRITICAL: ${summary.findingsBySeverity.critical}`);
	}
	if (summary.findingsBySeverity.high > 0) {
		lines.push(`  HIGH: ${summary.findingsBySeverity.high}`);
	}
	if (summary.findingsBySeverity.medium > 0) {
		lines.push(`  MEDIUM: ${summary.findingsBySeverity.medium}`);
	}
	if (summary.findingsBySeverity.low > 0) {
		lines.push(`  LOW: ${summary.findingsBySeverity.low}`);
	}
	lines.push("");

	// Show detailed findings with allow hints
	for (const result of summary.results) {
		if (result.findings.length === 0) continue;

		lines.push(`${result.capabilityId}:`);
		for (const finding of result.findings) {
			const location = finding.line
				? `:${finding.line}${finding.column ? `:${finding.column}` : ""}`
				: "";
			const severity = finding.severity.toUpperCase().padEnd(8);
			lines.push(`  [${severity}] ${finding.file}${location}`);
			lines.push(`             ${finding.message}`);
			if (finding.details) {
				lines.push(`             ${finding.details}`);
			}
			// Add allow hint
			lines.push(
				`             To allow: omnidev security allow ${result.capabilityId} ${finding.type}`,
			);
			lines.push("");
		}
	}

	return lines.join("\n");
}

/**
 * Run security issues scan
 */
export async function runSecurityIssues(flags: { verbose?: boolean } = {}): Promise<void> {
	try {
		// Check if OmniDev is initialized
		if (!existsSync("omni.toml")) {
			console.log("No config file found");
			console.log("  Run: omnidev init");
			process.exit(1);
		}

		console.log("Scanning capabilities for security issues...");
		console.log("");

		// Build registry to get all capabilities
		const registry = await buildCapabilityRegistry();
		const capabilities = registry.getAllCapabilities();

		if (capabilities.length === 0) {
			console.log("No capabilities found to scan.");
			return;
		}

		// Scan capabilities
		const capabilityInfos = capabilities.map((cap) => ({
			id: cap.id,
			path: cap.path,
		}));

		const summary = await scanCapabilities(capabilityInfos);

		// Filter out allowed findings
		const filteredSummary = await filterAllowedFindings(summary);

		// Format and display results
		if (flags.verbose) {
			console.log(formatScanResults(filteredSummary, true));
		} else {
			console.log(formatFindingsWithHints(filteredSummary));
		}

		// Show count of allowed findings if any were filtered
		const allowedCount = summary.totalFindings - filteredSummary.totalFindings;
		if (allowedCount > 0) {
			console.log(`(${allowedCount} allowed finding(s) hidden)`);
			console.log("");
		}

		// Exit with error code if there are non-passing findings
		if (!filteredSummary.allPassed) {
			process.exit(1);
		}
	} catch (error) {
		console.error("Error scanning capabilities:", error);
		process.exit(1);
	}
}

/**
 * Run security allow command
 */
export async function runSecurityAllow(
	_flags: Record<string, never>,
	capabilityId: string,
	findingType: string,
): Promise<void> {
	try {
		// Validate finding type
		if (!isValidFindingType(findingType)) {
			console.error(`Invalid finding type: '${findingType}'`);
			console.log("");
			console.log("Valid types:");
			for (const type of VALID_FINDING_TYPES) {
				console.log(`  - ${type}`);
			}
			process.exit(1);
		}

		const added = await addSecurityAllow(capabilityId, findingType);

		if (added) {
			console.log(`Allowed ${findingType} for capability: ${capabilityId}`);
		} else {
			console.log(`Already allowed: ${findingType} for ${capabilityId}`);
		}
	} catch (error) {
		console.error("Error adding security allow:", error);
		process.exit(1);
	}
}

/**
 * Run security deny command (remove allow)
 */
export async function runSecurityDeny(
	_flags: Record<string, never>,
	capabilityId: string,
	findingType: string,
): Promise<void> {
	try {
		// Validate finding type
		if (!isValidFindingType(findingType)) {
			console.error(`Invalid finding type: '${findingType}'`);
			console.log("");
			console.log("Valid types:");
			for (const type of VALID_FINDING_TYPES) {
				console.log(`  - ${type}`);
			}
			process.exit(1);
		}

		const removed = await removeSecurityAllow(capabilityId, findingType);

		if (removed) {
			console.log(`Removed allow for ${findingType} on capability: ${capabilityId}`);
		} else {
			console.log(`No allow found for: ${findingType} on ${capabilityId}`);
		}
	} catch (error) {
		console.error("Error removing security allow:", error);
		process.exit(1);
	}
}

/**
 * Run security list allows command
 */
export async function runSecurityListAllows(): Promise<void> {
	try {
		const allows = await getAllSecurityAllows();

		if (allows.length === 0) {
			console.log("No security allows configured.");
			console.log("");
			console.log("Use 'omnidev security allow <cap-id> <type>' to add allows.");
			return;
		}

		console.log("Security Allows:");
		console.log("");

		// Group by capability
		const byCapability: Record<string, FindingType[]> = {};
		for (const allow of allows) {
			const existing = byCapability[allow.capabilityId];
			if (existing) {
				existing.push(allow.findingType);
			} else {
				byCapability[allow.capabilityId] = [allow.findingType];
			}
		}

		for (const [capId, types] of Object.entries(byCapability)) {
			console.log(`  ${capId}:`);
			for (const type of types) {
				console.log(`    - ${type}`);
			}
			console.log("");
		}
	} catch (error) {
		console.error("Error listing security allows:", error);
		process.exit(1);
	}
}

// Build commands

const issuesCommand = buildCommand({
	docs: {
		brief: "Scan capabilities for security issues",
		fullDescription: `Scan all enabled capabilities for security issues.

Security checks include:
- Suspicious Unicode characters (bidi overrides, zero-width, control chars)
- Symlinks that escape capability directories
- Suspicious script patterns (curl|sh, eval, etc.)
- Binary files in content directories

Findings can be allowed using 'omnidev security allow <cap-id> <type>'.

Examples:
  omnidev security issues
  omnidev security issues --verbose`,
	},
	parameters: {
		flags: {
			verbose: {
				kind: "boolean" as const,
				brief: "Show verbose output with raw format",
				optional: true,
			},
		},
	},
	async func(flags: { verbose?: boolean }) {
		await runSecurityIssues(flags);
	},
});

const allowCommand = buildCommand({
	docs: {
		brief: "Allow a security finding type for a capability",
		fullDescription: `Allow (ignore) a specific security finding type for a capability.

This stores the allow in .omni/security.json. Allowed findings are hidden
from 'omnidev security issues' output.

Finding types:
  unicode_bidi       - Bidirectional text override characters
  unicode_zero_width - Zero-width characters
  unicode_control    - Suspicious control characters
  symlink_escape     - Symlinks escaping capability directory
  symlink_absolute   - Symlinks with absolute paths
  suspicious_script  - Suspicious script patterns
  binary_file        - Binary files in content directories

Examples:
  omnidev security allow my-capability unicode_bidi
  omnidev security allow my-capability suspicious_script`,
	},
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Capability ID",
					parse: String,
				},
				{
					brief: "Finding type to allow",
					parse: String,
				},
			],
		},
	},
	func: runSecurityAllow,
});

const denyCommand = buildCommand({
	docs: {
		brief: "Remove a security allow",
		fullDescription: `Remove a previously allowed security finding type.

This removes the allow from .omni/security.json. The finding will
appear again in 'omnidev security issues' output.

Examples:
  omnidev security deny my-capability unicode_bidi
  omnidev security deny my-capability suspicious_script`,
	},
	parameters: {
		flags: {},
		positional: {
			kind: "tuple" as const,
			parameters: [
				{
					brief: "Capability ID",
					parse: String,
				},
				{
					brief: "Finding type to remove allow for",
					parse: String,
				},
			],
		},
	},
	func: runSecurityDeny,
});

const listAllowsCommand = buildCommand({
	docs: {
		brief: "List all security allows",
	},
	parameters: {},
	async func() {
		await runSecurityListAllows();
	},
});

export const securityRoutes = buildRouteMap({
	routes: {
		issues: issuesCommand,
		allow: allowCommand,
		deny: denyCommand,
		"list-allows": listAllowsCommand,
	},
	docs: {
		brief: "Security scanning and allows",
	},
});
