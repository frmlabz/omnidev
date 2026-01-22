/**
 * Git-sourced capabilities: fetching, wrapping, and version management
 *
 * This module handles:
 * - Cloning/fetching capabilities from Git repositories
 * - Wrapping external repos (discovering skills/agents/commands)
 * - Managing the capabilities.lock.toml file
 * - Version tracking and update detection
 */

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import type {
	CapabilitiesLockFile,
	CapabilityLockEntry,
	CapabilitySourceConfig,
	FileCapabilitySourceConfig,
	GitCapabilitySourceConfig,
	OmniConfig,
	VersionSource,
} from "../types/index.js";
import { isFileSourceConfig } from "../types/index.js";
import { createHash } from "node:crypto";

// Local path for .omni directory
const OMNI_LOCAL = ".omni";

// Directory names to scan for content (singular and plural forms)
const SKILL_DIRS = ["skills", "skill"];
const AGENT_DIRS = ["agents", "agent", "subagents", "subagent"];
const COMMAND_DIRS = ["commands", "command"];
const RULE_DIRS = ["rules", "rule"];
const DOC_DIRS = ["docs", "doc", "documentation"];

// File patterns for each content type
const SKILL_FILES = ["SKILL.md", "skill.md", "Skill.md"];
const AGENT_FILES = ["AGENT.md", "agent.md", "Agent.md", "SUBAGENT.md", "subagent.md"];
const COMMAND_FILES = ["COMMAND.md", "command.md", "Command.md"];

export interface FetchResult {
	id: string;
	path: string;
	version: string;
	/** Source where version was detected from */
	versionSource: VersionSource;
	/** Git commit hash */
	commit?: string;
	/** Content hash for file sources (SHA-256) */
	contentHash?: string;
	updated: boolean;
	wrapped: boolean;
}

export interface SourceUpdateInfo {
	id: string;
	source: string;
	currentVersion: string;
	latestVersion: string;
	hasUpdate: boolean;
}

async function spawnCapture(
	command: string,
	args: string[],
	options?: { cwd?: string },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options?.cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout?.setEncoding("utf-8");
		child.stderr?.setEncoding("utf-8");

		child.stdout?.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk;
		});

		child.on("error", (error) => reject(error));
		child.on("close", (exitCode) => {
			resolve({ exitCode: exitCode ?? 0, stdout, stderr });
		});
	});
}

/**
 * Check if a source string is a git source
 */
export function isGitSource(source: string): boolean {
	return (
		source.startsWith("github:") ||
		source.startsWith("git@") ||
		source.startsWith("https://") ||
		source.startsWith("http://")
	);
}

/**
 * Check if a source string is a file source
 */
export function isFileSource(source: string): boolean {
	return source.startsWith("file://");
}

/**
 * Parse a file:// source to get the actual file path
 */
export function parseFileSourcePath(source: string): string {
	if (!source.startsWith("file://")) {
		throw new Error(`Invalid file source: ${source}`);
	}
	return source.slice(7); // Remove "file://" prefix
}

/**
 * Read the capability ID from a capability directory
 * Tries to read from capability.toml first, then falls back to directory name
 */
export async function readCapabilityIdFromPath(capabilityPath: string): Promise<string | null> {
	const tomlPath = join(capabilityPath, "capability.toml");

	if (existsSync(tomlPath)) {
		try {
			const content = await readFile(tomlPath, "utf-8");
			const parsed = parseToml(content) as Record<string, unknown>;
			const capability = parsed["capability"] as Record<string, unknown> | undefined;
			if (capability?.["id"] && typeof capability["id"] === "string") {
				return capability["id"];
			}
		} catch {
			// Fall through to directory name
		}
	}

	// Fall back to directory name
	const parts = capabilityPath.replace(/\\/g, "/").split("/");
	const dirName = parts.pop() || parts.pop(); // Handle trailing slash
	return dirName || null;
}

/**
 * Parse a capability source string or config into normalized form
 * Returns a GitCapabilitySourceConfig or FileCapabilitySourceConfig
 */
export function parseSourceConfig(
	source: CapabilitySourceConfig,
): GitCapabilitySourceConfig | FileCapabilitySourceConfig {
	if (typeof source === "string") {
		// Check for file source
		if (isFileSource(source)) {
			return { source } as FileCapabilitySourceConfig;
		}

		// Git source shorthand formats:
		// - "github:user/repo"
		// - "github:user/repo#version"
		// - "git@github.com:user/repo.git"
		// - "https://github.com/user/repo.git"

		let sourceUrl = source;
		let version: string | undefined;

		// Check for version in github shorthand
		if (source.startsWith("github:") && source.includes("#")) {
			const parts = source.split("#");
			sourceUrl = parts[0] ?? source;
			version = parts[1];
		}

		const result: GitCapabilitySourceConfig = { source: sourceUrl };
		if (version) {
			result.version = version;
		}
		return result;
	}

	// Check if the config object is a file source
	if (isFileSourceConfig(source)) {
		return source as FileCapabilitySourceConfig;
	}

	// Git source object format
	const gitSource = source as GitCapabilitySourceConfig;
	const result: GitCapabilitySourceConfig = {
		source: gitSource.source,
	};
	if (gitSource.path) {
		result.path = gitSource.path;
	}
	if (gitSource.version) {
		result.version = gitSource.version;
	}
	return result;
}

/**
 * Convert source to a git-cloneable URL
 */
export function sourceToGitUrl(source: string): string {
	if (source.startsWith("github:")) {
		const repo = source.replace("github:", "");
		return `https://github.com/${repo}.git`;
	}
	// Already a URL or SSH path
	return source;
}

/**
 * Get the path where a capability source will be stored
 */
export function getSourceCapabilityPath(id: string): string {
	return join(OMNI_LOCAL, "capabilities", id);
}

/**
 * Get the lock file path
 */
export function getLockFilePath(): string {
	return "omni.lock.toml";
}

/**
 * Load the capabilities lock file
 */
export async function loadLockFile(): Promise<CapabilitiesLockFile> {
	const lockPath = getLockFilePath();
	if (!existsSync(lockPath)) {
		return { capabilities: {} };
	}

	try {
		const content = await readFile(lockPath, "utf-8");
		const parsed = parseToml(content) as Record<string, unknown>;
		const rawCapabilities = parsed["capabilities"] as
			| Record<string, Record<string, unknown>>
			| undefined;

		if (!rawCapabilities) {
			return { capabilities: {} };
		}

		const capabilities: Record<string, CapabilityLockEntry> = {};
		for (const [id, entry] of Object.entries(rawCapabilities)) {
			const lockEntry: CapabilityLockEntry = {
				source: entry["source"] as string,
				version: entry["version"] as string,
				updated_at: entry["updated_at"] as string,
			};
			if (entry["version_source"]) {
				lockEntry.version_source = entry["version_source"] as VersionSource;
			}
			if (entry["commit"]) {
				lockEntry.commit = entry["commit"] as string;
			}
			if (entry["content_hash"]) {
				lockEntry.content_hash = entry["content_hash"] as string;
			}
			if (entry["pinned_version"]) {
				lockEntry.pinned_version = entry["pinned_version"] as string;
			}
			capabilities[id] = lockEntry;
		}

		return { capabilities };
	} catch {
		return { capabilities: {} };
	}
}

/**
 * Stringify a lock file to TOML format
 */
function stringifyLockFile(lockFile: CapabilitiesLockFile): string {
	const lines: string[] = [];

	for (const [id, entry] of Object.entries(lockFile.capabilities)) {
		lines.push(`[capabilities.${id}]`);
		lines.push(`source = "${entry.source}"`);
		lines.push(`version = "${entry.version}"`);
		if (entry.version_source) {
			lines.push(`version_source = "${entry.version_source}"`);
		}
		if (entry.commit) {
			lines.push(`commit = "${entry.commit}"`);
		}
		if (entry.pinned_version) {
			lines.push(`pinned_version = "${entry.pinned_version}"`);
		}
		if (entry.content_hash) {
			lines.push(`content_hash = "${entry.content_hash}"`);
		}
		lines.push(`updated_at = "${entry.updated_at}"`);
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Save the capabilities lock file
 */
export async function saveLockFile(lockFile: CapabilitiesLockFile): Promise<void> {
	const lockPath = getLockFilePath();

	// Ensure directory exists
	await mkdir(join(OMNI_LOCAL, "capabilities"), { recursive: true });

	const header = `# Auto-generated by OmniDev - DO NOT EDIT
# Records installed capability versions for reproducibility
# Last updated: ${new Date().toISOString()}

`;
	const content = header + stringifyLockFile(lockFile);
	await writeFile(lockPath, content, "utf-8");
}

/**
 * Get the current commit hash of a git repository
 */
async function getRepoCommit(repoPath: string): Promise<string> {
	const { exitCode, stdout, stderr } = await spawnCapture("git", ["rev-parse", "HEAD"], {
		cwd: repoPath,
	});
	if (exitCode !== 0) {
		throw new Error(`Failed to get commit for ${repoPath}: ${stderr.trim()}`);
	}
	return stdout.trim();
}

/**
 * Get short commit hash (7 chars)
 */
function shortCommit(commit: string): string {
	return commit.substring(0, 7);
}

/**
 * Get short content hash (12 chars)
 */
function shortContentHash(hash: string): string {
	return hash.substring(0, 12);
}

/**
 * Default patterns to exclude from content hashing
 */
const CONTENT_HASH_EXCLUDES = [
	".git",
	"node_modules",
	".omni",
	"__pycache__",
	".pytest_cache",
	".mypy_cache",
	"dist",
	"build",
	".DS_Store",
	"Thumbs.db",
];

/**
 * Compute a stable SHA-256 content hash for a directory.
 * Files are processed in sorted order to ensure deterministic output.
 * Excludes common non-semantic artifacts (.git, node_modules, etc.)
 */
export async function computeContentHash(
	dirPath: string,
	excludePatterns: string[] = CONTENT_HASH_EXCLUDES,
): Promise<string> {
	const hash = createHash("sha256");
	const files: Array<{ relativePath: string; content: Buffer }> = [];

	async function collectFiles(currentPath: string, relativeTo: string): Promise<void> {
		const entries = await readdir(currentPath, { withFileTypes: true });
		// Sort entries for deterministic ordering
		entries.sort((a, b) => a.name.localeCompare(b.name));

		for (const entry of entries) {
			const fullPath = join(currentPath, entry.name);
			const relativePath = fullPath.slice(relativeTo.length + 1);

			// Skip excluded patterns
			if (
				excludePatterns.some(
					(pattern) => entry.name === pattern || relativePath.startsWith(`${pattern}/`),
				)
			) {
				continue;
			}

			if (entry.isDirectory()) {
				await collectFiles(fullPath, relativeTo);
			} else if (entry.isFile()) {
				const content = await readFile(fullPath);
				files.push({ relativePath, content });
			}
			// Skip symlinks for security
		}
	}

	await collectFiles(dirPath, dirPath);

	// Sort files by path and hash them
	files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
	for (const file of files) {
		// Include both path and content in hash for integrity
		hash.update(file.relativePath);
		hash.update(file.content);
	}

	return hash.digest("hex");
}

/**
 * Result of version detection
 */
export interface VersionDetectionResult {
	version: string;
	source: VersionSource;
}

/**
 * Detect the display version for a capability directory.
 * Checks in order: capability.toml > plugin.json > package.json > fallback
 *
 * @param dirPath - Path to the capability directory
 * @param fallback - Fallback version if no source is found (e.g., commit hash or content hash)
 * @param fallbackSource - Source type for the fallback
 */
export async function detectDisplayVersion(
	dirPath: string,
	fallback: string,
	fallbackSource: VersionSource,
): Promise<VersionDetectionResult> {
	// 1. Check capability.toml
	const capTomlPath = join(dirPath, "capability.toml");
	if (existsSync(capTomlPath)) {
		try {
			const content = await readFile(capTomlPath, "utf-8");
			const parsed = parseToml(content) as Record<string, unknown>;
			const capability = parsed["capability"] as Record<string, unknown> | undefined;
			if (capability?.["version"] && typeof capability["version"] === "string") {
				return { version: capability["version"], source: "capability.toml" };
			}
		} catch {
			// Continue to next source
		}
	}

	// 2. Check .claude-plugin/plugin.json
	const pluginJsonPath = join(dirPath, ".claude-plugin", "plugin.json");
	if (existsSync(pluginJsonPath)) {
		try {
			const content = await readFile(pluginJsonPath, "utf-8");
			const parsed = JSON.parse(content);
			if (parsed.version && typeof parsed.version === "string") {
				return { version: parsed.version, source: "plugin.json" };
			}
		} catch {
			// Continue to next source
		}
	}

	// 3. Check package.json
	const pkgJsonPath = join(dirPath, "package.json");
	if (existsSync(pkgJsonPath)) {
		try {
			const content = await readFile(pkgJsonPath, "utf-8");
			const parsed = JSON.parse(content);
			if (parsed.version && typeof parsed.version === "string") {
				return { version: parsed.version, source: "package.json" };
			}
		} catch {
			// Continue to fallback
		}
	}

	// 4. Fallback to commit hash (git) or content hash (file)
	return { version: fallback, source: fallbackSource };
}

/**
 * Detect a version to pin for a git repository.
 * Clones the repo temporarily, checks for version in capability.toml,
 * falls back to HEAD commit hash.
 *
 * @param sourceUrl - Git source URL or shorthand (e.g., "github:user/repo")
 * @param subPath - Optional subdirectory within the repo
 * @returns The detected version string (from capability.toml or commit hash)
 */
export async function detectPinVersion(sourceUrl: string, subPath?: string): Promise<string> {
	const gitUrl = sourceToGitUrl(sourceUrl);
	const tempPath = join(OMNI_LOCAL, "_temp", `_pin-detect-${Date.now()}`);

	try {
		// Clone to temp location
		await mkdir(join(tempPath, ".."), { recursive: true });
		const args = ["clone", "--depth", "1", gitUrl, tempPath];
		const { exitCode, stderr } = await spawnCapture("git", args);
		if (exitCode !== 0) {
			throw new Error(`Failed to clone ${gitUrl}: ${stderr.trim()}`);
		}

		// Get commit hash
		const commit = await getRepoCommit(tempPath);

		// Determine which directory to check for capability.toml
		const checkPath = subPath ? join(tempPath, subPath) : tempPath;

		// Try to get version from capability.toml
		const capTomlPath = join(checkPath, "capability.toml");
		if (existsSync(capTomlPath)) {
			try {
				const content = await readFile(capTomlPath, "utf-8");
				const parsed = parseToml(content) as Record<string, unknown>;
				const capability = parsed["capability"] as Record<string, unknown> | undefined;
				if (capability?.["version"] && typeof capability["version"] === "string") {
					return capability["version"] as string;
				}
			} catch {
				// Fall through to commit hash
			}
		}

		// Try plugin.json
		const pluginJsonPath = join(checkPath, ".claude-plugin", "plugin.json");
		if (existsSync(pluginJsonPath)) {
			try {
				const content = await readFile(pluginJsonPath, "utf-8");
				const parsed = JSON.parse(content);
				if (parsed.version && typeof parsed.version === "string") {
					return parsed.version;
				}
			} catch {
				// Fall through to commit hash
			}
		}

		// Fallback to commit hash
		return commit;
	} finally {
		// Clean up temp directory
		if (existsSync(tempPath)) {
			await rm(tempPath, { recursive: true });
		}
	}
}

/**
 * Clone a git repository
 */
async function cloneRepo(gitUrl: string, targetPath: string, ref?: string): Promise<void> {
	// Ensure parent directory exists
	await mkdir(join(targetPath, ".."), { recursive: true });

	const args = ["clone", "--depth", "1"];
	if (ref) {
		args.push("--branch", ref);
	}
	args.push(gitUrl, targetPath);

	const { exitCode, stderr } = await spawnCapture("git", args);
	if (exitCode !== 0) {
		throw new Error(`Failed to clone ${gitUrl}: ${stderr.trim()}`);
	}
}

/**
 * Fetch and update an existing repository
 */
async function fetchRepo(repoPath: string, ref?: string): Promise<boolean> {
	// Fetch latest
	const fetchResult = await spawnCapture("git", ["fetch", "--depth", "1", "origin"], {
		cwd: repoPath,
	});
	if (fetchResult.exitCode !== 0) {
		throw new Error(`Failed to fetch in ${repoPath}: ${fetchResult.stderr.trim()}`);
	}

	// Get current and remote commits
	const currentCommit = await getRepoCommit(repoPath);

	// Check remote commit
	const targetRef = ref || "HEAD";
	const lsResult = await spawnCapture("git", ["ls-remote", "origin", targetRef], {
		cwd: repoPath,
	});
	if (lsResult.exitCode !== 0) {
		throw new Error(`Failed to ls-remote in ${repoPath}: ${lsResult.stderr.trim()}`);
	}

	const remoteCommit = lsResult.stdout.split("\t")[0];

	if (currentCommit === remoteCommit) {
		return false; // No update
	}

	// Pull changes
	const pullResult = await spawnCapture("git", ["pull", "--ff-only"], { cwd: repoPath });
	if (pullResult.exitCode !== 0) {
		throw new Error(`Failed to pull in ${repoPath}: ${pullResult.stderr.trim()}`);
	}

	return true; // Updated
}

/**
 * Check if a directory contains a capability.toml
 */
function hasCapabilityToml(dirPath: string): boolean {
	return existsSync(join(dirPath, "capability.toml"));
}

/**
 * Check if a directory should be wrapped (has plugin.json or appropriate structure)
 * Returns true if:
 * 1. .claude-plugin/plugin.json exists, OR
 * 2. Any of the expected content directories exist (skills, agents, commands, rules, docs)
 */
async function shouldWrapDirectory(dirPath: string): Promise<boolean> {
	// Check for plugin.json
	if (existsSync(join(dirPath, ".claude-plugin", "plugin.json"))) {
		return true;
	}

	// Check for any expected content directories
	const allDirs = [...SKILL_DIRS, ...AGENT_DIRS, ...COMMAND_DIRS, ...RULE_DIRS, ...DOC_DIRS];
	for (const dirName of allDirs) {
		const checkPath = join(dirPath, dirName);
		if (existsSync(checkPath)) {
			const stats = await stat(checkPath);
			if (stats.isDirectory()) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Find directories matching any of the given names
 */
async function findMatchingDirs(basePath: string, names: string[]): Promise<string | null> {
	for (const name of names) {
		const dirPath = join(basePath, name);
		if (existsSync(dirPath)) {
			const stats = await stat(dirPath);
			if (stats.isDirectory()) {
				return dirPath;
			}
		}
	}
	return null;
}

/**
 * Find content files in a directory (skills, agents, commands)
 */
async function findContentItems(
	dirPath: string,
	filePatterns: string[],
): Promise<Array<{ name: string; path: string; isFolder: boolean }>> {
	const items: Array<{ name: string; path: string; isFolder: boolean }> = [];

	if (!existsSync(dirPath)) {
		return items;
	}

	const entries = (await readdir(dirPath, { withFileTypes: true })).sort((a, b) =>
		a.name.localeCompare(b.name),
	);

	for (const entry of entries) {
		const entryPath = join(dirPath, entry.name);

		if (entry.isDirectory()) {
			// Check for content file inside directory
			for (const pattern of filePatterns) {
				if (existsSync(join(entryPath, pattern))) {
					items.push({
						name: entry.name,
						path: entryPath,
						isFolder: true,
					});
					break;
				}
			}
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			// Single file content (e.g., agents/researcher.md)
			const name = entry.name.replace(/\.md$/i, "");
			items.push({
				name,
				path: entryPath,
				isFolder: false,
			});
		}
	}

	return items;
}

/**
 * Plugin metadata from .claude-plugin/plugin.json
 */
export interface PluginMetadata {
	name?: string;
	version?: string;
	description?: string;
	author?: {
		name?: string;
		email?: string;
	};
}

/**
 * Parse .claude-plugin/plugin.json if it exists
 */
async function parsePluginJson(dirPath: string): Promise<PluginMetadata | null> {
	const pluginJsonPath = join(dirPath, ".claude-plugin", "plugin.json");
	if (!existsSync(pluginJsonPath)) {
		return null;
	}

	try {
		const content = await readFile(pluginJsonPath, "utf-8");
		const data = JSON.parse(content);
		const result: PluginMetadata = {
			name: data.name,
			version: data.version,
			description: data.description,
		};
		if (data.author) {
			result.author = {
				name: data.author.name,
				email: data.author.email,
			};
		}
		return result;
	} catch (error) {
		console.warn(`Failed to parse plugin.json in ${dirPath}:`, error);
		return null;
	}
}

/**
 * Read README.md and extract description
 * Returns the first paragraph or the first 200 characters
 */
async function readReadmeDescription(dirPath: string): Promise<string | null> {
	const readmePath = join(dirPath, "README.md");
	if (!existsSync(readmePath)) {
		return null;
	}

	try {
		const content = await readFile(readmePath, "utf-8");
		// Remove markdown headers and get first non-empty paragraph
		const lines = content.split("\n");
		let description = "";
		let inCodeBlock = false;

		for (const line of lines) {
			const trimmed = line.trim();

			// Track code blocks
			if (trimmed.startsWith("```")) {
				inCodeBlock = !inCodeBlock;
				continue;
			}

			// Skip headers, empty lines, and code blocks
			if (
				inCodeBlock ||
				trimmed.startsWith("#") ||
				trimmed.length === 0 ||
				trimmed.startsWith("![")
			) {
				continue;
			}

			// Found content
			description += (description ? " " : "") + trimmed;

			// Stop at first paragraph (200 chars or first blank line after content)
			if (description.length >= 200) {
				break;
			}
		}

		if (description.length > 200) {
			description = `${description.substring(0, 197)}...`;
		}

		return description || null;
	} catch (error) {
		console.warn(`Failed to read README.md in ${dirPath}:`, error);
		return null;
	}
}

/**
 * Discover content in a wrapped repository
 */
export interface DiscoveredContent {
	skills: Array<{ name: string; path: string; isFolder: boolean }>;
	agents: Array<{ name: string; path: string; isFolder: boolean }>;
	commands: Array<{ name: string; path: string; isFolder: boolean }>;
	rulesDir: string | null;
	docsDir: string | null;
}

/**
 * Rename singular folder names to plural for consistency
 * skill -> skills, command -> commands, rule -> rules, agent -> agents
 */
export async function normalizeFolderNames(repoPath: string): Promise<void> {
	const renameMappings = [
		{ from: "skill", to: "skills" },
		{ from: "command", to: "commands" },
		{ from: "rule", to: "rules" },
		{ from: "agent", to: "agents" },
		{ from: "subagent", to: "subagents" },
	];

	for (const { from, to } of renameMappings) {
		const fromPath = join(repoPath, from);
		const toPath = join(repoPath, to);

		// Only rename if singular exists and plural doesn't
		if (existsSync(fromPath) && !existsSync(toPath)) {
			try {
				const stats = await stat(fromPath);
				if (stats.isDirectory()) {
					await rename(fromPath, toPath);
				}
			} catch (error) {
				// Ignore rename errors (might be permissions, etc.)
				console.warn(`Failed to rename ${from} to ${to}:`, error);
			}
		}
	}
}

async function discoverContent(repoPath: string): Promise<DiscoveredContent> {
	const result: DiscoveredContent = {
		skills: [],
		agents: [],
		commands: [],
		rulesDir: null,
		docsDir: null,
	};

	// Find skills
	const skillsDir = await findMatchingDirs(repoPath, SKILL_DIRS);
	if (skillsDir) {
		result.skills = await findContentItems(skillsDir, SKILL_FILES);
	}

	// Find agents
	const agentsDir = await findMatchingDirs(repoPath, AGENT_DIRS);
	if (agentsDir) {
		result.agents = await findContentItems(agentsDir, AGENT_FILES);
	}

	// Find commands
	const commandsDir = await findMatchingDirs(repoPath, COMMAND_DIRS);
	if (commandsDir) {
		result.commands = await findContentItems(commandsDir, COMMAND_FILES);
	}

	// Find rules directory
	result.rulesDir = await findMatchingDirs(repoPath, RULE_DIRS);

	// Find docs directory
	result.docsDir = await findMatchingDirs(repoPath, DOC_DIRS);

	return result;
}

/**
 * Generate a capability.toml for a wrapped repository
 */
async function generateCapabilityToml(
	id: string,
	repoPath: string,
	source: string,
	commit: string,
	content: DiscoveredContent,
): Promise<void> {
	const shortHash = shortCommit(commit);

	// Try to get metadata from plugin.json
	const pluginMeta = await parsePluginJson(repoPath);

	// Try to get description from README
	const readmeDesc = await readReadmeDescription(repoPath);

	// Build description based on available sources
	let description: string;
	if (pluginMeta?.description) {
		description = pluginMeta.description;
	} else if (readmeDesc) {
		description = readmeDesc;
	} else {
		// Fallback: build from discovered content
		const parts: string[] = [];
		if (content.skills.length > 0) {
			parts.push(`${content.skills.length} skill${content.skills.length > 1 ? "s" : ""}`);
		}
		if (content.agents.length > 0) {
			parts.push(`${content.agents.length} agent${content.agents.length > 1 ? "s" : ""}`);
		}
		if (content.commands.length > 0) {
			parts.push(`${content.commands.length} command${content.commands.length > 1 ? "s" : ""}`);
		}
		description = parts.length > 0 ? `${parts.join(", ")}` : `Wrapped from ${source}`;
	}

	// Use plugin metadata for name and version if available
	const name = pluginMeta?.name || `${id} (wrapped)`;
	const version = pluginMeta?.version || shortHash;

	// Extract repository URL for metadata
	const repoUrl = source.startsWith("github:")
		? `https://github.com/${source.replace("github:", "")}`
		: source;

	// Build TOML content
	let tomlContent = `# Auto-generated by OmniDev - DO NOT EDIT
# This capability was wrapped from an external repository

[capability]
id = "${id}"
name = "${name}"
version = "${version}"
description = "${description}"
`;

	// Add author if available from plugin.json
	if (pluginMeta?.author?.name || pluginMeta?.author?.email) {
		tomlContent += "\n[capability.author]\n";
		if (pluginMeta.author.name) {
			tomlContent += `name = "${pluginMeta.author.name}"\n`;
		}
		if (pluginMeta.author.email) {
			tomlContent += `email = "${pluginMeta.author.email}"\n`;
		}
	}

	// Add metadata section
	tomlContent += `
[capability.metadata]
repository = "${repoUrl}"
wrapped = true
commit = "${commit}"
`;

	await writeFile(join(repoPath, "capability.toml"), tomlContent, "utf-8");
}

/**
 * Fetch a git-sourced capability
 */
async function fetchGitCapabilitySource(
	id: string,
	config: GitCapabilitySourceConfig,
	options?: { silent?: boolean },
): Promise<FetchResult> {
	const gitUrl = sourceToGitUrl(config.source);
	const targetPath = getSourceCapabilityPath(id);

	let updated = false;
	let commit: string;
	let repoPath: string;

	// Resolve version: "latest" or undefined means fetch default branch (no ref)
	const gitRef = config.version && config.version !== "latest" ? config.version : undefined;

	// If path is specified, clone to temp location first
	if (config.path) {
		const tempPath = join(OMNI_LOCAL, "_temp", `${id}-repo`);

		// Check if already cloned to temp
		if (existsSync(join(tempPath, ".git"))) {
			updated = await fetchRepo(tempPath, gitRef);
			commit = await getRepoCommit(tempPath);
		} else {
			await mkdir(join(tempPath, ".."), { recursive: true });
			await cloneRepo(gitUrl, tempPath, gitRef);
			commit = await getRepoCommit(tempPath);
			updated = true;
		}

		// Copy subdirectory to target
		const sourcePath = join(tempPath, config.path);
		if (!existsSync(sourcePath)) {
			throw new Error(`Path not found in repository: ${config.path}`);
		}

		// Remove old target and copy new content
		if (existsSync(targetPath)) {
			await rm(targetPath, { recursive: true });
		}
		await mkdir(join(targetPath, ".."), { recursive: true });
		await cp(sourcePath, targetPath, { recursive: true });

		// Clean up temp directory after successful copy
		await rm(tempPath, { recursive: true });

		repoPath = targetPath;
	} else {
		// Clone directly to target (no subdirectory)
		if (existsSync(join(targetPath, ".git"))) {
			if (!options?.silent) {
				console.log(`  Checking ${id}...`);
			}
			updated = await fetchRepo(targetPath, gitRef);
			commit = await getRepoCommit(targetPath);
		} else {
			if (!options?.silent) {
				console.log(`  Cloning ${id} from ${config.source}...`);
			}
			await cloneRepo(gitUrl, targetPath, gitRef);
			commit = await getRepoCommit(targetPath);
			updated = true;
		}

		repoPath = targetPath;
	}

	// Auto-detect if we need to wrap
	let needsWrap = false;
	if (!hasCapabilityToml(repoPath)) {
		needsWrap = await shouldWrapDirectory(repoPath);
	}

	if (needsWrap) {
		// Normalize folder names (singular -> plural)
		await normalizeFolderNames(repoPath);

		// Discover content and generate capability.toml
		const content = await discoverContent(repoPath);
		await generateCapabilityToml(id, repoPath, config.source, commit, content);

		if (!options?.silent) {
			const parts: string[] = [];
			if (content.skills.length > 0) parts.push(`${content.skills.length} skills`);
			if (content.agents.length > 0) parts.push(`${content.agents.length} agents`);
			if (content.commands.length > 0) parts.push(`${content.commands.length} commands`);
			if (parts.length > 0) {
				console.log(`    Wrapped: ${parts.join(", ")}`);
			}
		}
	}

	// Detect version using unified version detection
	// Fallback to short commit hash for git sources
	const versionResult = await detectDisplayVersion(repoPath, shortCommit(commit), "commit");

	return {
		id,
		path: targetPath,
		version: versionResult.version,
		versionSource: versionResult.source,
		commit,
		updated,
		wrapped: needsWrap,
	};
}

/**
 * Fetch a file-sourced capability (copy from local path)
 * Supports wrapping directories without capability.toml if they have skills/agents/etc.
 */
async function fetchFileCapabilitySource(
	id: string,
	config: FileCapabilitySourceConfig,
	options?: { silent?: boolean },
): Promise<FetchResult> {
	const sourcePath = parseFileSourcePath(config.source);
	const targetPath = getSourceCapabilityPath(id);

	// Validate source exists
	if (!existsSync(sourcePath)) {
		throw new Error(`File source not found: ${sourcePath}`);
	}

	// Check if it's a directory
	const sourceStats = await stat(sourcePath);
	if (!sourceStats.isDirectory()) {
		throw new Error(`File source must be a directory: ${sourcePath}`);
	}

	// Compute content hash for the source (before copy, for reproducibility)
	const contentHash = await computeContentHash(sourcePath);

	// Check if we need to wrap (no capability.toml but has content)
	const hasCapToml = existsSync(join(sourcePath, "capability.toml"));
	let needsWrap = false;

	if (!hasCapToml) {
		needsWrap = await shouldWrapDirectory(sourcePath);
		if (!needsWrap) {
			throw new Error(
				`No capability.toml found in: ${sourcePath} (and no wrappable content detected)`,
			);
		}
	}

	if (!options?.silent) {
		console.log(`  Copying ${id} from ${sourcePath}...`);
	}

	// Remove old target if exists
	if (existsSync(targetPath)) {
		await rm(targetPath, { recursive: true });
	}

	// Create parent directory
	await mkdir(join(targetPath, ".."), { recursive: true });

	// Copy directory contents
	await cp(sourcePath, targetPath, { recursive: true });

	// If needs wrapping, generate capability.toml in target (not source)
	if (needsWrap) {
		// Normalize folder names (singular -> plural)
		await normalizeFolderNames(targetPath);

		// Discover content and generate capability.toml
		const content = await discoverContent(targetPath);
		await generateFileSourceCapabilityToml(
			id,
			config.source,
			shortContentHash(contentHash),
			content,
			targetPath,
		);

		if (!options?.silent) {
			const parts: string[] = [];
			if (content.skills.length > 0) parts.push(`${content.skills.length} skills`);
			if (content.agents.length > 0) parts.push(`${content.agents.length} agents`);
			if (content.commands.length > 0) parts.push(`${content.commands.length} commands`);
			if (parts.length > 0) {
				console.log(`    Wrapped: ${parts.join(", ")}`);
			}
		}
	}

	// Detect version using unified version detection
	// Fallback to short content hash for file sources
	const versionResult = await detectDisplayVersion(
		targetPath,
		shortContentHash(contentHash),
		"content_hash",
	);

	return {
		id,
		path: targetPath,
		version: versionResult.version,
		versionSource: versionResult.source,
		contentHash,
		updated: true,
		wrapped: needsWrap,
	};
}

/**
 * Generate a capability.toml for a wrapped file source
 */
async function generateFileSourceCapabilityToml(
	id: string,
	source: string,
	hashVersion: string,
	content: DiscoveredContent,
	targetPath: string,
): Promise<void> {
	// Try to get metadata from plugin.json
	const pluginMeta = await parsePluginJson(targetPath);

	// Try to get description from README
	const readmeDesc = await readReadmeDescription(targetPath);

	// Build description based on available sources
	let description: string;
	if (pluginMeta?.description) {
		description = pluginMeta.description;
	} else if (readmeDesc) {
		description = readmeDesc;
	} else {
		// Fallback: build from discovered content
		const parts: string[] = [];
		if (content.skills.length > 0) {
			parts.push(`${content.skills.length} skill${content.skills.length > 1 ? "s" : ""}`);
		}
		if (content.agents.length > 0) {
			parts.push(`${content.agents.length} agent${content.agents.length > 1 ? "s" : ""}`);
		}
		if (content.commands.length > 0) {
			parts.push(`${content.commands.length} command${content.commands.length > 1 ? "s" : ""}`);
		}
		description = parts.length > 0 ? `${parts.join(", ")}` : `Wrapped from ${source}`;
	}

	// Use plugin metadata for name and version if available
	const name = pluginMeta?.name || `${id} (wrapped)`;
	const version = pluginMeta?.version || hashVersion;

	// Build TOML content
	let tomlContent = `# Auto-generated by OmniDev - DO NOT EDIT
# This capability was wrapped from a local directory

[capability]
id = "${id}"
name = "${name}"
version = "${version}"
description = "${description}"
`;

	// Add author if available from plugin.json
	if (pluginMeta?.author?.name || pluginMeta?.author?.email) {
		tomlContent += "\n[capability.author]\n";
		if (pluginMeta.author.name) {
			tomlContent += `name = "${pluginMeta.author.name}"\n`;
		}
		if (pluginMeta.author.email) {
			tomlContent += `email = "${pluginMeta.author.email}"\n`;
		}
	}

	// Add metadata section
	tomlContent += `
[capability.metadata]
wrapped = true
source = "${source}"
`;

	await writeFile(join(targetPath, "capability.toml"), tomlContent, "utf-8");
}

/**
 * Fetch a single capability source (git or file)
 */
export async function fetchCapabilitySource(
	id: string,
	sourceConfig: CapabilitySourceConfig,
	options?: { silent?: boolean },
): Promise<FetchResult> {
	const config = parseSourceConfig(sourceConfig);

	// Check if it's a file source
	if (isFileSourceConfig(sourceConfig) || isFileSource(config.source)) {
		return fetchFileCapabilitySource(id, config as FileCapabilitySourceConfig, options);
	}

	return fetchGitCapabilitySource(id, config as GitCapabilitySourceConfig, options);
}

/**
 * Generate capability.toml content for an MCP server definition
 */
function generateMcpCapabilityTomlContent(
	id: string,
	mcpConfig: import("../types/index.js").McpConfig,
): string {
	const transport = mcpConfig.transport ?? "stdio";
	const isRemote = transport === "http" || transport === "sse";

	let tomlContent = `# Auto-generated by OmniDev from omni.toml [mcps] section - DO NOT EDIT

[capability]
id = "${id}"
name = "${id} (MCP)"
version = "1.0.0"
description = "MCP server defined in omni.toml"

[capability.metadata]
wrapped = true
generated_from_omni_toml = true

[mcp]
`;

	// For remote transports (http/sse), url is required
	if (isRemote) {
		tomlContent += `transport = "${transport}"\n`;
		if (mcpConfig.url) {
			tomlContent += `url = "${mcpConfig.url}"\n`;
		}
	} else {
		// For stdio transport, command is required
		if (mcpConfig.command) {
			tomlContent += `command = "${mcpConfig.command}"\n`;
		}

		if (mcpConfig.args && mcpConfig.args.length > 0) {
			tomlContent += `args = ${JSON.stringify(mcpConfig.args)}\n`;
		}

		if (mcpConfig.transport) {
			tomlContent += `transport = "${mcpConfig.transport}"\n`;
		}

		if (mcpConfig.cwd) {
			tomlContent += `cwd = "${mcpConfig.cwd}"\n`;
		}
	}

	// Headers for remote transports
	if (isRemote && mcpConfig.headers && Object.keys(mcpConfig.headers).length > 0) {
		tomlContent += `\n[mcp.headers]\n`;
		for (const [key, value] of Object.entries(mcpConfig.headers)) {
			tomlContent += `"${key}" = "${value}"\n`;
		}
	}

	// Env variables for stdio transport
	if (!isRemote && mcpConfig.env && Object.keys(mcpConfig.env).length > 0) {
		tomlContent += `\n[mcp.env]\n`;
		for (const [key, value] of Object.entries(mcpConfig.env)) {
			tomlContent += `${key} = "${value}"\n`;
		}
	}

	return tomlContent;
}

/**
 * Generate synthetic capability for an MCP server definition
 */
async function generateMcpCapabilityToml(
	id: string,
	mcpConfig: import("../types/index.js").McpConfig,
	targetPath: string,
): Promise<void> {
	const tomlContent = generateMcpCapabilityTomlContent(id, mcpConfig);
	await writeFile(join(targetPath, "capability.toml"), tomlContent, "utf-8");
}

/**
 * Check if a capability directory was generated from omni.toml [mcps] section
 */
async function isGeneratedMcpCapability(capabilityDir: string): Promise<boolean> {
	const tomlPath = join(capabilityDir, "capability.toml");
	if (!existsSync(tomlPath)) {
		console.warn("no capability.toml found in", capabilityDir);
		return false;
	}

	try {
		const content = await readFile(tomlPath, "utf-8");
		const parsed = parseToml(content) as Record<string, unknown>;
		const capability = parsed["capability"] as Record<string, unknown> | undefined;
		const metadata = capability?.["metadata"] as Record<string, unknown> | undefined;
		return metadata?.["generated_from_omni_toml"] === true;
	} catch {
		return false;
	}
}

/**
 * Clean up stale MCP capabilities that are no longer in config
 */
async function cleanupStaleMcpCapabilities(currentMcpIds: Set<string>): Promise<void> {
	const capabilitiesDir = join(OMNI_LOCAL, "capabilities");
	if (!existsSync(capabilitiesDir)) {
		return;
	}

	const entries = await readdir(capabilitiesDir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const capDir = join(capabilitiesDir, entry.name);
			const isGenerated = await isGeneratedMcpCapability(capDir);
			if (isGenerated && !currentMcpIds.has(entry.name)) {
				// This MCP capability is no longer in omni.toml, remove it
				await rm(capDir, { recursive: true });
			}
		}
	}
}

/**
 * Generate synthetic capabilities for MCP definitions in omni.toml
 */
export async function generateMcpCapabilities(config: OmniConfig): Promise<void> {
	if (!config.mcps || Object.keys(config.mcps).length === 0) {
		// Clean up all MCP capabilities if mcps section is empty
		await cleanupStaleMcpCapabilities(new Set());
		return;
	}

	const mcpCapabilitiesDir = join(OMNI_LOCAL, "capabilities");
	const currentMcpIds = new Set<string>();

	for (const [id, mcpConfig] of Object.entries(config.mcps)) {
		const targetPath = join(mcpCapabilitiesDir, id);
		currentMcpIds.add(id);

		// Create directory
		await mkdir(targetPath, { recursive: true });

		// Generate capability.toml
		await generateMcpCapabilityToml(id, mcpConfig, targetPath);
	}

	// Cleanup stale MCP capabilities
	await cleanupStaleMcpCapabilities(currentMcpIds);
}

/**
 * Result of fetching all capability sources
 */
export interface FetchAllResult {
	results: FetchResult[];
	warnings: SyncWarning[];
}

/**
 * Fetch all capability sources from config
 */
export async function fetchAllCapabilitySources(
	config: OmniConfig,
	options?: { silent?: boolean; force?: boolean },
): Promise<FetchAllResult> {
	// Generate MCP capabilities FIRST
	await generateMcpCapabilities(config);

	// Clean up any stale temp directories from previous syncs
	const tempDir = join(OMNI_LOCAL, "_temp");
	if (existsSync(tempDir)) {
		await rm(tempDir, { recursive: true });
	}

	const sources = config.capabilities?.sources;
	if (!sources || Object.keys(sources).length === 0) {
		return { results: [], warnings: [] };
	}

	const results: FetchResult[] = [];
	const warnings: SyncWarning[] = [];
	const lockFile = await loadLockFile();
	let lockUpdated = false;

	for (const [id, source] of Object.entries(sources)) {
		try {
			// Parse source config to check for missing version
			const parsedConfig = parseSourceConfig(source);

			// Warn about missing version for git sources
			if (!isFileSourceConfig(source) && !isFileSource(parsedConfig.source)) {
				const gitConfig = parsedConfig as GitCapabilitySourceConfig;
				if (!gitConfig.version) {
					warnings.push({
						id,
						message: "no version specified, defaulting to latest",
					});
				}
			}

			const result = await fetchCapabilitySource(id, source, options);
			results.push(result);

			// Build lock entry based on source type
			const lockEntry: CapabilityLockEntry = {
				source: typeof source === "string" ? source : source.source,
				version: result.version,
				version_source: result.versionSource,
				updated_at: new Date().toISOString(),
			};

			// Git source: use commit and pinned version
			if (result.commit) {
				lockEntry.commit = result.commit;
			}
			// File source: use content hash
			if (result.contentHash) {
				lockEntry.content_hash = result.contentHash;
			}
			// Only access version if it's a git source (store as pinned_version in lock)
			if (!isFileSourceConfig(source)) {
				const gitConfig = parseSourceConfig(source) as GitCapabilitySourceConfig;
				if (gitConfig.version && gitConfig.version !== "latest") {
					lockEntry.pinned_version = gitConfig.version;
				}
			}

			// Check for version mismatch (commit changed but version unchanged)
			const existing = lockFile.capabilities[id];
			if (existing && result.commit) {
				const mismatchWarning = checkVersionMismatch(existing, result.commit, result.version);
				if (mismatchWarning) {
					warnings.push({ id, message: mismatchWarning });
				}
			}

			// Check if lock entry changed
			// For git sources: compare commit hash
			// For file sources: compare content hash
			const hasChanged =
				!existing ||
				(result.commit && existing.commit !== result.commit) ||
				(result.contentHash && existing.content_hash !== result.contentHash);

			if (hasChanged) {
				lockFile.capabilities[id] = lockEntry;
				lockUpdated = true;
			}
		} catch (error) {
			console.error(`  Failed to fetch ${id}: ${error}`);
		}
	}

	// Save lock file if changed
	if (lockUpdated) {
		await saveLockFile(lockFile);
	}

	return { results, warnings };
}

/**
 * Check for available updates without applying them
 */
export async function checkForUpdates(config: OmniConfig): Promise<SourceUpdateInfo[]> {
	const sources = config.capabilities?.sources;
	if (!sources || Object.keys(sources).length === 0) {
		return [];
	}

	const lockFile = await loadLockFile();
	const updates: SourceUpdateInfo[] = [];

	for (const [id, source] of Object.entries(sources)) {
		const sourceConfig = parseSourceConfig(source);
		const targetPath = getSourceCapabilityPath(id);
		const existing = lockFile.capabilities[id];

		// Skip file sources - they don't have update checking
		if (isFileSourceConfig(source) || isFileSource(sourceConfig.source)) {
			updates.push({
				id,
				source: sourceConfig.source,
				currentVersion: existing?.version || "local",
				latestVersion: "local",
				hasUpdate: false,
			});
			continue;
		}

		// Handle git sources
		const gitConfig = sourceConfig as GitCapabilitySourceConfig;

		if (!existsSync(join(targetPath, ".git"))) {
			// Not yet cloned
			updates.push({
				id,
				source: gitConfig.source,
				currentVersion: "not installed",
				latestVersion: "unknown",
				hasUpdate: true,
			});
			continue;
		}

		// Fetch to check for updates (without pulling)
		const fetchResult = await spawnCapture("git", ["fetch", "--depth", "1", "origin"], {
			cwd: targetPath,
		});
		if (fetchResult.exitCode !== 0) {
			throw new Error(`Failed to fetch in ${targetPath}: ${fetchResult.stderr.trim()}`);
		}

		// Get remote commit
		// If version is "latest" or undefined, check HEAD; otherwise use the specified version
		const targetRef =
			gitConfig.version && gitConfig.version !== "latest" ? gitConfig.version : "HEAD";
		const lsResult = await spawnCapture("git", ["ls-remote", "origin", targetRef], {
			cwd: targetPath,
		});
		if (lsResult.exitCode !== 0) {
			throw new Error(`Failed to ls-remote in ${targetPath}: ${lsResult.stderr.trim()}`);
		}

		const remoteCommit = lsResult.stdout.split("\t")[0] || "";
		const currentCommit = existing?.commit || "";

		updates.push({
			id,
			source: gitConfig.source,
			currentVersion: existing?.version || (currentCommit ? shortCommit(currentCommit) : "unknown"),
			latestVersion: remoteCommit ? shortCommit(remoteCommit) : "unknown",
			hasUpdate: currentCommit !== remoteCommit,
		});
	}

	return updates;
}

/**
 * Warning info for version/integrity issues detected during sync
 */
export interface SyncWarning {
	id: string;
	message: string;
}

/**
 * Check for version mismatch: commit changed but version string unchanged.
 * This can indicate a maintainer forgot to bump the version.
 *
 * @param lockEntry - Existing lock entry from previous sync
 * @param currentCommit - Current commit hash after fetch
 * @param currentVersion - Current detected version
 * @returns Warning message if mismatch detected, null otherwise
 */
export function checkVersionMismatch(
	lockEntry: CapabilityLockEntry,
	currentCommit: string,
	currentVersion: string,
): string | null {
	// Only warn if:
	// 1. Commit changed
	// 2. Version string is unchanged
	// 3. Version was sourced from capability.toml (not commit hash)
	if (
		lockEntry.commit !== currentCommit &&
		lockEntry.version === currentVersion &&
		lockEntry.version_source === "capability.toml"
	) {
		return "version unchanged but content changed";
	}
	return null;
}

/**
 * Verify integrity of a capability against its lock entry.
 * Checks that the current state matches what was recorded in the lock file.
 *
 * @param id - Capability ID
 * @param lockEntry - Lock entry to verify against
 * @returns Warning message if integrity issue found, null otherwise
 */
export async function verifyIntegrity(
	id: string,
	lockEntry: CapabilityLockEntry,
): Promise<string | null> {
	const capabilityPath = getSourceCapabilityPath(id);

	if (!existsSync(capabilityPath)) {
		return "capability directory missing";
	}

	// For git sources: verify commit matches
	if (lockEntry.commit) {
		const gitDir = join(capabilityPath, ".git");
		if (existsSync(gitDir)) {
			try {
				const currentCommit = await getRepoCommit(capabilityPath);
				if (currentCommit !== lockEntry.commit) {
					return "content modified locally";
				}
			} catch {
				// Can't verify - skip
			}
		}
	}

	// For file sources: verify content hash matches
	if (lockEntry.content_hash) {
		try {
			const currentHash = await computeContentHash(capabilityPath);
			if (currentHash !== lockEntry.content_hash) {
				return "content modified locally";
			}
		} catch {
			// Can't verify - skip
		}
	}

	return null;
}
