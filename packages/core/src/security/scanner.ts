/**
 * Security scanner implementation
 *
 * Scans capability directories for potential supply-chain issues:
 * - Suspicious Unicode characters (bidi overrides, zero-width, control chars)
 * - Symlinks that could escape the capability directory
 * - Suspicious script patterns
 * - Binary files in content directories
 */

import { existsSync } from "node:fs";
import { lstat, readdir, readFile, readlink, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type {
	FindingSeverity,
	FindingType,
	ScanResult,
	ScanSettings,
	ScanSummary,
	SecurityConfig,
	SecurityFinding,
} from "./types";
import { DEFAULT_SCAN_SETTINGS } from "./types";

/**
 * Suspicious Unicode codepoint ranges
 */
const UNICODE_PATTERNS = {
	// Bidirectional text override characters (can hide malicious code)
	bidi: [
		0x202a, // LEFT-TO-RIGHT EMBEDDING
		0x202b, // RIGHT-TO-LEFT EMBEDDING
		0x202c, // POP DIRECTIONAL FORMATTING
		0x202d, // LEFT-TO-RIGHT OVERRIDE
		0x202e, // RIGHT-TO-LEFT OVERRIDE
		0x2066, // LEFT-TO-RIGHT ISOLATE
		0x2067, // RIGHT-TO-LEFT ISOLATE
		0x2068, // FIRST STRONG ISOLATE
		0x2069, // POP DIRECTIONAL ISOLATE
	],
	// Zero-width characters (can hide content)
	zeroWidth: [
		0x200b, // ZERO WIDTH SPACE
		0x200c, // ZERO WIDTH NON-JOINER
		0x200d, // ZERO WIDTH JOINER
		0x2060, // WORD JOINER
		0xfeff, // ZERO WIDTH NO-BREAK SPACE (BOM when not at start)
	],
	// Control characters (excluding common ones like \n, \r, \t)
	control: [
		0x0000, // NUL
		0x0001, // SOH
		0x0002, // STX
		0x0003, // ETX
		0x0004, // EOT
		0x0005, // ENQ
		0x0006, // ACK
		0x0007, // BEL
		0x0008, // BS
		// 0x0009 TAB - allowed
		// 0x000A LF - allowed
		0x000b, // VT
		0x000c, // FF
		// 0x000D CR - allowed
		0x000e, // SO
		0x000f, // SI
		0x0010, // DLE
		0x0011, // DC1
		0x0012, // DC2
		0x0013, // DC3
		0x0014, // DC4
		0x0015, // NAK
		0x0016, // SYN
		0x0017, // ETB
		0x0018, // CAN
		0x0019, // EM
		0x001a, // SUB
		0x001b, // ESC
		0x001c, // FS
		0x001d, // GS
		0x001e, // RS
		0x001f, // US
		0x007f, // DEL
	],
};

/**
 * Suspicious script patterns (regex patterns and descriptions)
 */
const SUSPICIOUS_SCRIPT_PATTERNS: Array<{
	pattern: RegExp;
	message: string;
	severity: FindingSeverity;
}> = [
	{
		pattern: /curl\s+.*\|\s*(ba)?sh/i,
		message: "Piping curl to shell can execute arbitrary remote code",
		severity: "high",
	},
	{
		pattern: /wget\s+.*\|\s*(ba)?sh/i,
		message: "Piping wget to shell can execute arbitrary remote code",
		severity: "high",
	},
	{
		pattern: /eval\s*\(\s*\$\(/,
		message: "eval with command substitution can be dangerous",
		severity: "medium",
	},
	{
		pattern: /rm\s+-rf\s+\/($|\s)|rm\s+-rf\s+~($|\s)/,
		message: "Recursive deletion from root or home directory",
		severity: "critical",
	},
	{
		pattern: /chmod\s+777/,
		message: "Setting world-writable permissions",
		severity: "medium",
	},
	{
		pattern: /\bsudo\b.*>/,
		message: "Using sudo with output redirection",
		severity: "medium",
	},
	{
		pattern: /base64\s+-d.*\|\s*(ba)?sh/i,
		message: "Decoding and executing base64 content",
		severity: "high",
	},
];

/**
 * Patterns for outbound network requests (even without pipe-to-shell).
 * These are suspicious in capability/skill content because they can
 * exfiltrate data or download malicious payloads.
 */
const NETWORK_REQUEST_PATTERNS: Array<{
	pattern: RegExp;
	message: string;
	severity: FindingSeverity;
}> = [
	{
		pattern: /\bcurl\s+.*https?:\/\//i,
		message: "Outbound curl request detected",
		severity: "medium",
	},
	{
		pattern: /\bwget\s+.*https?:\/\//i,
		message: "Outbound wget request detected",
		severity: "medium",
	},
	{
		pattern: /\bfetch\s*\(\s*["'`]https?:\/\//i,
		message: "Outbound fetch() request detected",
		severity: "medium",
	},
	{
		pattern: /\b(?:http|https)\.(?:get|request|post|put)\s*\(/i,
		message: "Outbound HTTP request via Node.js http module",
		severity: "medium",
	},
	{
		pattern: /\brequests\.(?:get|post|put|delete|patch)\s*\(/i,
		message: "Outbound HTTP request via Python requests",
		severity: "medium",
	},
	{
		pattern: /\bnc\b.*\s\d{2,5}\b/i,
		message: "Netcat connection detected",
		severity: "high",
	},
	{
		pattern: /\b(?:Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b/i,
		message: "Outbound PowerShell web request detected",
		severity: "medium",
	},
];

/**
 * Patterns that indicate executable commands hidden in content.
 * Used to detect commands inside HTML comments, invisible markup, etc.
 */
const HIDDEN_COMMAND_PATTERNS: Array<{
	pattern: RegExp;
	message: string;
	severity: FindingSeverity;
}> = [
	// Backtick-wrapped commands (prompt injection via rendered-invisible content)
	{
		pattern: /`[^`]*(?:curl|wget|bash|sh|python|ruby|node|exec|eval|system)\s[^`]*`/i,
		message: "Executable command in backtick-wrapped code",
		severity: "critical",
	},
	// Shell pipe patterns
	{
		pattern: /\|\s*(?:ba)?sh\b/i,
		message: "Pipe to shell execution",
		severity: "critical",
	},
	// Direct shell invocations
	{
		pattern: /(?:^|\s)(?:bash|sh|zsh)\s+-c\s+/i,
		message: "Shell invocation with -c flag",
		severity: "high",
	},
	// Common command patterns
	{
		pattern: /\b(?:curl|wget)\s+.*https?:\/\//i,
		message: "Network fetch command detected",
		severity: "high",
	},
	// Python/Ruby/Node one-liners
	{
		pattern: /\b(?:python|ruby|node)\s+-e\s+/i,
		message: "Inline script execution",
		severity: "high",
	},
	// eval/exec with strings
	{
		pattern: /\beval\s*\(.*\)/i,
		message: "eval() call detected",
		severity: "high",
	},
];

/**
 * File extensions that are considered binary (not content files)
 */
const BINARY_EXTENSIONS = new Set([
	".exe",
	".dll",
	".so",
	".dylib",
	".bin",
	".o",
	".a",
	".lib",
	".pyc",
	".pyo",
	".class",
	".jar",
	".war",
	".ear",
	".wasm",
	".node",
]);

/**
 * File extensions that should be scanned for content
 */
const TEXT_EXTENSIONS = new Set([
	".md",
	".txt",
	".toml",
	".yaml",
	".yml",
	".json",
	".js",
	".ts",
	".sh",
	".bash",
	".zsh",
	".fish",
	".py",
	".rb",
]);

/**
 * Scan a file for suspicious Unicode characters
 */
async function scanFileForUnicode(
	filePath: string,
	relativePath: string,
): Promise<SecurityFinding[]> {
	const findings: SecurityFinding[] = [];

	try {
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum];
			if (!line) continue;

			for (let col = 0; col < line.length; col++) {
				const codePoint = line.codePointAt(col);
				if (codePoint === undefined) continue;

				// Check bidi characters
				if (UNICODE_PATTERNS.bidi.includes(codePoint)) {
					findings.push({
						type: "unicode_bidi",
						severity: "high",
						file: relativePath,
						line: lineNum + 1,
						column: col + 1,
						message: "Bidirectional text override character detected",
						details: `Codepoint U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
					});
				}

				// Check zero-width characters (skip BOM at start of file)
				if (UNICODE_PATTERNS.zeroWidth.includes(codePoint)) {
					// Skip BOM at the very start of file
					if (codePoint === 0xfeff && lineNum === 0 && col === 0) continue;

					findings.push({
						type: "unicode_zero_width",
						severity: "medium",
						file: relativePath,
						line: lineNum + 1,
						column: col + 1,
						message: "Zero-width character detected",
						details: `Codepoint U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
					});
				}

				// Check control characters
				if (UNICODE_PATTERNS.control.includes(codePoint)) {
					findings.push({
						type: "unicode_control",
						severity: "medium",
						file: relativePath,
						line: lineNum + 1,
						column: col + 1,
						message: "Suspicious control character detected",
						details: `Codepoint U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
					});
				}
			}
		}
	} catch {
		// File might be binary or unreadable, skip
	}

	return findings;
}

/**
 * Scan a file for suspicious script patterns
 */
async function scanFileForScripts(
	filePath: string,
	relativePath: string,
): Promise<SecurityFinding[]> {
	const findings: SecurityFinding[] = [];

	try {
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum];
			if (!line) continue;

			for (const { pattern, message, severity } of SUSPICIOUS_SCRIPT_PATTERNS) {
				if (pattern.test(line)) {
					findings.push({
						type: "suspicious_script",
						severity,
						file: relativePath,
						line: lineNum + 1,
						message,
						details: line.trim().substring(0, 100),
					});
				}
			}
		}
	} catch {
		// File might be binary or unreadable, skip
	}

	return findings;
}

/**
 * Regex to match HTML comments, including multiline.
 * Captures the content between <!-- and -->
 */
const HTML_COMMENT_RE = /<!--([\s\S]*?)-->/g;

/**
 * Regex to match markdown link/image references that could hide content
 * e.g., [invisible]: https://evil.com "!`curl ...`"
 */
const HIDDEN_REFERENCE_RE = /^\[.*?\]:\s*\S+\s+"(.+)"/gm;

/**
 * Extract hidden content regions from a markdown file.
 * Returns array of { content, startLine } for each hidden region.
 */
function extractHiddenRegions(fileContent: string): Array<{ content: string; startLine: number }> {
	const regions: Array<{ content: string; startLine: number }> = [];

	// HTML comments
	HTML_COMMENT_RE.lastIndex = 0;
	for (
		let match = HTML_COMMENT_RE.exec(fileContent);
		match !== null;
		match = HTML_COMMENT_RE.exec(fileContent)
	) {
		const captured = match[1];
		if (captured === undefined) continue;
		const beforeMatch = fileContent.substring(0, match.index);
		const startLine = beforeMatch.split("\n").length;
		regions.push({ content: captured, startLine });
	}

	// Hidden reference definitions with title text
	HIDDEN_REFERENCE_RE.lastIndex = 0;
	for (
		let match = HIDDEN_REFERENCE_RE.exec(fileContent);
		match !== null;
		match = HIDDEN_REFERENCE_RE.exec(fileContent)
	) {
		const captured = match[1];
		if (captured === undefined) continue;
		const beforeMatch = fileContent.substring(0, match.index);
		const startLine = beforeMatch.split("\n").length;
		regions.push({ content: captured, startLine });
	}

	return regions;
}

/**
 * Scan a markdown file for commands hidden in HTML comments and other
 * invisible markup. This catches the prompt injection attack vector where
 * malicious commands are placed inside <!-- --> so they're invisible
 * when the markdown is rendered but still processed by the LLM.
 */
async function scanFileForHiddenCommands(
	filePath: string,
	relativePath: string,
): Promise<SecurityFinding[]> {
	const findings: SecurityFinding[] = [];

	try {
		const content = await readFile(filePath, "utf-8");
		const hiddenRegions = extractHiddenRegions(content);

		for (const region of hiddenRegions) {
			const regionLines = region.content.split("\n");

			for (let i = 0; i < regionLines.length; i++) {
				const line = regionLines[i] ?? "";
				if (!line.trim()) continue;

				for (const { pattern, message, severity } of HIDDEN_COMMAND_PATTERNS) {
					if (pattern.test(line)) {
						findings.push({
							type: "hidden_command",
							severity,
							file: relativePath,
							line: region.startLine + i,
							message: `Hidden in comment: ${message}`,
							details: line.trim().substring(0, 100),
						});
					}
				}

				// Also check for network request patterns inside hidden content
				for (const { pattern, message, severity } of NETWORK_REQUEST_PATTERNS) {
					if (pattern.test(line)) {
						findings.push({
							type: "network_request",
							severity: severity === "medium" ? "high" : severity,
							file: relativePath,
							line: region.startLine + i,
							message: `Hidden in comment: ${message}`,
							details: line.trim().substring(0, 100),
						});
					}
				}

				// Also check for suspicious script patterns inside hidden content
				for (const { pattern, message, severity } of SUSPICIOUS_SCRIPT_PATTERNS) {
					if (pattern.test(line)) {
						findings.push({
							type: "hidden_command",
							severity: severity === "medium" ? "high" : severity,
							file: relativePath,
							line: region.startLine + i,
							message: `Hidden in comment: ${message}`,
							details: line.trim().substring(0, 100),
						});
					}
				}
			}
		}
	} catch {
		// File might be unreadable, skip
	}

	return findings;
}

/**
 * Scan a file for outbound network request patterns (visible content).
 * Unlike hidden command scanning, this checks visible lines in content files
 * for network calls that could exfiltrate data or fetch malicious payloads.
 */
async function scanFileForNetworkRequests(
	filePath: string,
	relativePath: string,
): Promise<SecurityFinding[]> {
	const findings: SecurityFinding[] = [];

	try {
		const content = await readFile(filePath, "utf-8");
		const lines = content.split("\n");

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum];
			if (!line) continue;

			for (const { pattern, message, severity } of NETWORK_REQUEST_PATTERNS) {
				if (pattern.test(line)) {
					findings.push({
						type: "network_request",
						severity,
						file: relativePath,
						line: lineNum + 1,
						message,
						details: line.trim().substring(0, 100),
					});
				}
			}
		}
	} catch {
		// File might be unreadable, skip
	}

	return findings;
}

/**
 * Check if a symlink escapes the capability directory
 */
async function checkSymlink(
	symlinkPath: string,
	relativePath: string,
	capabilityRoot: string,
): Promise<SecurityFinding | null> {
	try {
		const linkTarget = await readlink(symlinkPath);
		const resolvedTarget = resolve(join(symlinkPath, "..", linkTarget));
		const normalizedRoot = await realpath(capabilityRoot);

		// Check if it's an absolute path
		if (linkTarget.startsWith("/")) {
			return {
				type: "symlink_absolute",
				severity: "high",
				file: relativePath,
				message: "Symlink points to an absolute path",
				details: `Target: ${linkTarget}`,
			};
		}

		// Check if resolved path escapes capability root
		const relativeToRoot = relative(normalizedRoot, resolvedTarget);
		if (relativeToRoot.startsWith("..") || relativeToRoot.startsWith("/")) {
			return {
				type: "symlink_escape",
				severity: "critical",
				file: relativePath,
				message: "Symlink escapes capability directory",
				details: `Resolves to: ${resolvedTarget}`,
			};
		}
	} catch {
		// Broken symlink or permission issue
	}

	return null;
}

/**
 * Check if a file is a binary
 */
function isBinaryFile(filePath: string): boolean {
	const ext = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
	return BINARY_EXTENSIONS.has(ext);
}

/**
 * Check if a file should be scanned for text content
 */
function isTextFile(filePath: string): boolean {
	const ext = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
	return TEXT_EXTENSIONS.has(ext);
}

/**
 * Scan a single capability directory
 */
export async function scanCapability(
	capabilityId: string,
	capabilityPath: string,
	settings: ScanSettings = DEFAULT_SCAN_SETTINGS,
): Promise<ScanResult> {
	const startTime = Date.now();
	const findings: SecurityFinding[] = [];

	if (!existsSync(capabilityPath)) {
		return {
			capabilityId,
			path: capabilityPath,
			findings: [],
			passed: true,
			duration: Date.now() - startTime,
		};
	}

	// Recursively scan directory
	async function scanDirectory(dirPath: string): Promise<void> {
		const entries = await readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);
			const relativePath = relative(capabilityPath, fullPath);

			// Skip hidden files and common non-content directories
			if (
				entry.name.startsWith(".") ||
				entry.name === "node_modules" ||
				entry.name === "__pycache__"
			) {
				continue;
			}

			const stats = await lstat(fullPath);

			// Check symlinks
			if (stats.isSymbolicLink() && settings.symlinks) {
				const finding = await checkSymlink(fullPath, relativePath, capabilityPath);
				if (finding) {
					findings.push(finding);
				}
				continue; // Don't follow symlinks
			}

			// Handle directories
			if (entry.isDirectory()) {
				await scanDirectory(fullPath);
				continue;
			}

			// Handle files
			if (entry.isFile()) {
				// Check for binary files
				if (settings.binaries && isBinaryFile(fullPath)) {
					findings.push({
						type: "binary_file",
						severity: "low",
						file: relativePath,
						message: "Binary file detected in capability",
					});
				}

				// Only scan text files for content issues
				if (isTextFile(fullPath)) {
					const ext = fullPath.toLowerCase().substring(fullPath.lastIndexOf("."));

					// Scan for Unicode issues
					if (settings.unicode) {
						const unicodeFindings = await scanFileForUnicode(fullPath, relativePath);
						findings.push(...unicodeFindings);
					}

					// Scan for script issues (shell/script files)
					if (settings.scripts) {
						if ([".sh", ".bash", ".zsh", ".fish", ".py", ".rb", ".js", ".ts"].includes(ext)) {
							const scriptFindings = await scanFileForScripts(fullPath, relativePath);
							findings.push(...scriptFindings);
						}
					}

					// Scan for hidden commands in markdown/content files
					if (settings.hiddenCommands) {
						if ([".md", ".txt", ".yaml", ".yml", ".toml"].includes(ext)) {
							const hiddenFindings = await scanFileForHiddenCommands(fullPath, relativePath);
							findings.push(...hiddenFindings);
						}
					}

					// Scan all content files for network request patterns
					if (settings.hiddenCommands) {
						const networkFindings = await scanFileForNetworkRequests(fullPath, relativePath);
						findings.push(...networkFindings);
					}
				}
			}
		}
	}

	await scanDirectory(capabilityPath);

	return {
		capabilityId,
		path: capabilityPath,
		findings,
		passed: findings.length === 0 || findings.every((f) => f.severity === "low"),
		duration: Date.now() - startTime,
	};
}

/**
 * Scan multiple capabilities and produce a summary
 */
export async function scanCapabilities(
	capabilities: Array<{ id: string; path: string }>,
	config: SecurityConfig = {},
): Promise<ScanSummary> {
	const settings = {
		...DEFAULT_SCAN_SETTINGS,
		...config.scan,
	};

	const results: ScanResult[] = [];

	for (const cap of capabilities) {
		// Check if source is trusted
		if (config.trusted_sources && config.trusted_sources.length > 0) {
			// For now, skip trusted source checking (would need source info)
		}

		const result = await scanCapability(cap.id, cap.path, settings);
		results.push(result);
	}

	// Build summary
	const findingsByType: Record<FindingType, number> = {
		unicode_bidi: 0,
		unicode_zero_width: 0,
		unicode_control: 0,
		symlink_escape: 0,
		symlink_absolute: 0,
		suspicious_script: 0,
		binary_file: 0,
		hidden_command: 0,
		network_request: 0,
	};

	const findingsBySeverity: Record<FindingSeverity, number> = {
		low: 0,
		medium: 0,
		high: 0,
		critical: 0,
	};

	let totalFindings = 0;
	let capabilitiesWithFindings = 0;

	for (const result of results) {
		if (result.findings.length > 0) {
			capabilitiesWithFindings++;
		}
		for (const finding of result.findings) {
			totalFindings++;
			findingsByType[finding.type]++;
			findingsBySeverity[finding.severity]++;
		}
	}

	return {
		totalCapabilities: capabilities.length,
		capabilitiesWithFindings,
		totalFindings,
		findingsByType,
		findingsBySeverity,
		results,
		allPassed: results.every((r) => r.passed),
	};
}

/**
 * Format scan results for console output
 */
export function formatScanResults(summary: ScanSummary, verbose = false): string {
	const lines: string[] = [];

	lines.push("Security Scan Results");
	lines.push("=====================");
	lines.push("");

	if (summary.totalFindings === 0) {
		lines.push("✓ No security issues found");
		return lines.join("\n");
	}

	lines.push(
		`Found ${summary.totalFindings} issue(s) in ${summary.capabilitiesWithFindings} capability(ies)`,
	);
	lines.push("");

	// Show by severity
	if (summary.findingsBySeverity.critical > 0) {
		lines.push(`  ✗ Critical: ${summary.findingsBySeverity.critical}`);
	}
	if (summary.findingsBySeverity.high > 0) {
		lines.push(`  ✗ High: ${summary.findingsBySeverity.high}`);
	}
	if (summary.findingsBySeverity.medium > 0) {
		lines.push(`  ! Medium: ${summary.findingsBySeverity.medium}`);
	}
	if (summary.findingsBySeverity.low > 0) {
		lines.push(`  · Low: ${summary.findingsBySeverity.low}`);
	}
	lines.push("");

	// Show detailed findings if verbose
	if (verbose) {
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
			}
			lines.push("");
		}
	}

	return lines.join("\n");
}
