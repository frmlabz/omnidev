/**
 * Hook configuration validation
 *
 * Provides validation functions for hooks.toml configuration.
 * Used by: hooks loader, omni doctor, omni hooks validate
 */

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { HOOK_EVENTS, VARIABLE_MAPPINGS } from "./constants.js";
import type { HooksConfig, HookValidationResult, HookValidationIssue, HookEvent } from "./types.js";
import { isHookEvent, isHookType, isPromptHookEvent, isMatcherEvent } from "./types.js";

interface ValidationOptions {
	/** Base path for resolving script files */
	basePath?: string;
	/** Check if script files exist and are executable */
	checkScripts?: boolean;
}

/**
 * Validate a hooks configuration object
 */
export function validateHooksConfig(
	config: unknown,
	options?: ValidationOptions,
): HookValidationResult {
	const errors: HookValidationIssue[] = [];
	const warnings: HookValidationIssue[] = [];
	const opts: ValidationOptions = { checkScripts: false, ...options };

	// Must be an object
	if (typeof config !== "object" || config === null || Array.isArray(config)) {
		errors.push({
			severity: "error",
			code: "HOOKS_INVALID_TOML",
			message: "Hooks configuration must be an object",
		});
		return { valid: false, errors, warnings };
	}

	const configObj = config as Record<string, unknown>;

	// Check each key in the config
	for (const key of Object.keys(configObj)) {
		// Skip description field
		if (key === "description") {
			continue;
		}

		// Check if it's a valid event name
		if (!isHookEvent(key)) {
			errors.push({
				severity: "error",
				code: "HOOKS_UNKNOWN_EVENT",
				message: `Unknown hook event: "${key}"`,
				suggestion: `Valid events are: ${HOOK_EVENTS.join(", ")}`,
			});
			continue;
		}

		const event = key as HookEvent;
		const matchers = configObj[key];

		// Event value must be an array
		if (!Array.isArray(matchers)) {
			errors.push({
				severity: "error",
				code: "HOOKS_INVALID_TOML",
				event,
				message: `${event} must be an array of matchers`,
			});
			continue;
		}

		// Validate each matcher
		matchers.forEach((matcher, matcherIndex) => {
			const matcherIssues = validateMatcher(matcher, event, matcherIndex, opts);
			for (const issue of matcherIssues) {
				if (issue.severity === "error") {
					errors.push(issue);
				} else {
					warnings.push(issue);
				}
			}
		});
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Validate a single matcher entry
 */
function validateMatcher(
	matcher: unknown,
	event: HookEvent,
	matcherIndex: number,
	options: ValidationOptions,
): HookValidationIssue[] {
	const issues: HookValidationIssue[] = [];

	if (typeof matcher !== "object" || matcher === null || Array.isArray(matcher)) {
		issues.push({
			severity: "error",
			code: "HOOKS_INVALID_TOML",
			event,
			matcherIndex,
			message: `Matcher at index ${matcherIndex} must be an object`,
		});
		return issues;
	}

	const matcherObj = matcher as Record<string, unknown>;
	const matcherPattern = matcherObj["matcher"];

	// Validate matcher pattern if present
	if (matcherPattern !== undefined) {
		if (typeof matcherPattern !== "string") {
			issues.push({
				severity: "error",
				code: "HOOKS_INVALID_MATCHER",
				event,
				matcherIndex,
				message: "Matcher pattern must be a string",
			});
		} else {
			// Warn if matcher is set on non-matcher event (it will be ignored)
			if (!isMatcherEvent(event) && matcherPattern !== "" && matcherPattern !== "*") {
				issues.push({
					severity: "warning",
					code: "HOOKS_INVALID_MATCHER",
					event,
					matcherIndex,
					message: `Matcher pattern on ${event} will be ignored (this event doesn't support matchers)`,
				});
			}

			// Validate regex pattern
			const patternIssue = validateMatcherPattern(matcherPattern, event, matcherIndex);
			if (patternIssue) {
				issues.push(patternIssue);
			}
		}
	}

	// Validate hooks array
	if (!("hooks" in matcherObj)) {
		issues.push({
			severity: "error",
			code: "HOOKS_INVALID_HOOKS_ARRAY",
			event,
			matcherIndex,
			message: "Matcher must have a 'hooks' array",
		});
		return issues;
	}

	const hooksArray = matcherObj["hooks"];
	if (!Array.isArray(hooksArray)) {
		issues.push({
			severity: "error",
			code: "HOOKS_INVALID_HOOKS_ARRAY",
			event,
			matcherIndex,
			message: "'hooks' must be an array",
		});
		return issues;
	}

	if (hooksArray.length === 0) {
		issues.push({
			severity: "warning",
			code: "HOOKS_EMPTY_ARRAY",
			event,
			matcherIndex,
			message: "Empty hooks array",
		});
	}

	// Validate each hook
	hooksArray.forEach((hook, hookIndex) => {
		const hookIssues = validateHook(hook, event, { matcherIndex, hookIndex }, options);
		issues.push(...hookIssues);
	});

	return issues;
}

/**
 * Validate a single hook entry
 */
export function validateHook(
	hook: unknown,
	event: HookEvent,
	context: { matcherIndex: number; hookIndex: number },
	options?: ValidationOptions,
): HookValidationIssue[] {
	const issues: HookValidationIssue[] = [];
	const { matcherIndex, hookIndex } = context;

	if (typeof hook !== "object" || hook === null || Array.isArray(hook)) {
		issues.push({
			severity: "error",
			code: "HOOKS_INVALID_TOML",
			event,
			matcherIndex,
			hookIndex,
			message: "Hook must be an object",
		});
		return issues;
	}

	const hookObj = hook as Record<string, unknown>;

	// Check type field
	if (!("type" in hookObj)) {
		issues.push({
			severity: "error",
			code: "HOOKS_INVALID_TYPE",
			event,
			matcherIndex,
			hookIndex,
			message: "Hook must have a 'type' field",
		});
		return issues;
	}

	const hookType = hookObj["type"];
	if (typeof hookType !== "string" || !isHookType(hookType)) {
		issues.push({
			severity: "error",
			code: "HOOKS_INVALID_TYPE",
			event,
			matcherIndex,
			hookIndex,
			message: `Invalid hook type: "${String(hookType)}". Must be "command" or "prompt"`,
		});
		return issues;
	}

	// Check if prompt type is allowed for this event
	if (hookType === "prompt" && !isPromptHookEvent(event)) {
		issues.push({
			severity: "error",
			code: "HOOKS_PROMPT_NOT_ALLOWED",
			event,
			matcherIndex,
			hookIndex,
			message: `Prompt-type hooks are not allowed for ${event}`,
			suggestion: `Prompt hooks are only allowed for: Stop, SubagentStop, UserPromptSubmit, PreToolUse, PermissionRequest`,
		});
	}

	// Validate command hook
	if (hookType === "command") {
		const command = hookObj["command"];
		if (typeof command !== "string") {
			issues.push({
				severity: "error",
				code: "HOOKS_MISSING_COMMAND",
				event,
				matcherIndex,
				hookIndex,
				message: "Command hook must have a 'command' string field",
			});
		} else {
			// Check for CLAUDE_ variables (should use OMNIDEV_)
			const claudeVarMatch = command.match(/\$\{?CLAUDE_[A-Z_]+\}?/);
			if (claudeVarMatch) {
				const matchedVar = claudeVarMatch[0];
				if (matchedVar) {
					const omnidevVar = Object.entries(VARIABLE_MAPPINGS).find(([, claude]) =>
						matchedVar.includes(claude),
					)?.[0];
					const issue: HookValidationIssue = {
						severity: "warning",
						code: "HOOKS_CLAUDE_VARIABLE",
						event,
						matcherIndex,
						hookIndex,
						message: `Using Claude variable "${matchedVar}" instead of OmniDev variable`,
					};
					if (omnidevVar) {
						issue.suggestion = `Use \${${omnidevVar}} instead`;
					}
					issues.push(issue);
				}
			}

			// Check script file if enabled
			if (options?.checkScripts && options.basePath) {
				const scriptIssues = validateScriptInCommand(
					command,
					options.basePath,
					event,
					matcherIndex,
					hookIndex,
				);
				issues.push(...scriptIssues);
			}
		}
	}

	// Validate prompt hook
	if (hookType === "prompt") {
		const prompt = hookObj["prompt"];
		if (typeof prompt !== "string") {
			issues.push({
				severity: "error",
				code: "HOOKS_MISSING_PROMPT",
				event,
				matcherIndex,
				hookIndex,
				message: "Prompt hook must have a 'prompt' string field",
			});
		}
	}

	// Validate timeout
	if ("timeout" in hookObj) {
		const timeout = hookObj["timeout"];
		if (typeof timeout !== "number") {
			issues.push({
				severity: "error",
				code: "HOOKS_INVALID_TIMEOUT",
				event,
				matcherIndex,
				hookIndex,
				message: "Timeout must be a number",
			});
		} else if (timeout <= 0) {
			issues.push({
				severity: "error",
				code: "HOOKS_INVALID_TIMEOUT",
				event,
				matcherIndex,
				hookIndex,
				message: "Timeout must be a positive number",
			});
		}
	}

	return issues;
}

/**
 * Validate that a matcher pattern is a valid regex
 */
function validateMatcherPattern(
	pattern: string,
	event: HookEvent,
	matcherIndex: number,
): HookValidationIssue | null {
	// Empty string and "*" are valid (match all)
	if (pattern === "" || pattern === "*") {
		return null;
	}

	try {
		new RegExp(pattern);
		return null;
	} catch {
		return {
			severity: "error",
			code: "HOOKS_INVALID_MATCHER",
			event,
			matcherIndex,
			message: `Invalid regex pattern: "${pattern}"`,
		};
	}
}

/**
 * Check if a matcher regex pattern is valid
 */
export function isValidMatcherPattern(pattern: string): boolean {
	if (pattern === "" || pattern === "*") {
		return true;
	}
	try {
		new RegExp(pattern);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if script files referenced in a command exist and are executable
 */
function validateScriptInCommand(
	command: string,
	basePath: string,
	event: HookEvent,
	matcherIndex: number,
	hookIndex: number,
): HookValidationIssue[] {
	const issues: HookValidationIssue[] = [];

	// Extract potential script paths from the command
	// Look for paths like "${OMNIDEV_CAPABILITY_ROOT}/hooks/script.sh" or similar
	const scriptPatterns = [
		// Quoted paths with variables
		/"\$\{?OMNIDEV_CAPABILITY_ROOT\}?\/([^"]+)"/g,
		// Unquoted paths starting with ./
		/(?:^|\s)\.\/([^\s;|&]+)/g,
	];

	for (const pattern of scriptPatterns) {
		let match = pattern.exec(command);
		while (match !== null) {
			const relativePath = match[1];
			if (relativePath) {
				const fullPath = resolve(basePath, relativePath);

				if (!existsSync(fullPath)) {
					issues.push({
						severity: "error",
						code: "HOOKS_SCRIPT_NOT_FOUND",
						event,
						matcherIndex,
						hookIndex,
						path: fullPath,
						message: `Script file not found: ${relativePath}`,
					});
				} else {
					// Check if executable (Unix-like systems)
					try {
						const stats = statSync(fullPath);
						const isExecutable = !!(stats.mode & 0o111);
						if (!isExecutable) {
							issues.push({
								severity: "warning",
								code: "HOOKS_SCRIPT_NOT_EXECUTABLE",
								event,
								matcherIndex,
								hookIndex,
								path: fullPath,
								message: `Script file is not executable: ${relativePath}`,
								suggestion: `Run: chmod +x ${relativePath}`,
							});
						}
					} catch {
						// Ignore stat errors
					}
				}
			}
			match = pattern.exec(command);
		}
	}

	return issues;
}

/**
 * Check for duplicate commands across all hooks
 */
export function findDuplicateCommands(config: HooksConfig): HookValidationIssue[] {
	const issues: HookValidationIssue[] = [];
	const seenCommands = new Map<
		string,
		{ event: HookEvent; matcherIndex: number; hookIndex: number }
	>();

	for (const eventName of HOOK_EVENTS) {
		const matchers = config[eventName];
		if (!matchers) continue;

		matchers.forEach((matcher, matcherIndex) => {
			matcher.hooks.forEach((hook, hookIndex) => {
				if (hook.type === "command") {
					const command = hook.command;
					const existing = seenCommands.get(command);

					if (existing) {
						issues.push({
							severity: "warning",
							code: "HOOKS_DUPLICATE_COMMAND",
							event: eventName,
							matcherIndex,
							hookIndex,
							message: `Duplicate command found (also at ${existing.event}[${existing.matcherIndex}].hooks[${existing.hookIndex}])`,
						});
					} else {
						seenCommands.set(command, { event: eventName, matcherIndex, hookIndex });
					}
				}
			});
		});
	}

	return issues;
}

/**
 * Create an empty valid hooks config
 */
export function createEmptyHooksConfig(): HooksConfig {
	return {};
}

/**
 * Create an empty validation result (valid with no issues)
 */
export function createEmptyValidationResult(): HookValidationResult {
	return {
		valid: true,
		errors: [],
		warnings: [],
	};
}
