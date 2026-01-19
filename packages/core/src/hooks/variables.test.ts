// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Testing variable replacement requires ${} syntax in strings
import { describe, expect, test } from "bun:test";
import {
	transformToOmnidev,
	transformToClaude,
	transformHooksConfig,
	containsClaudeVariables,
	containsOmnidevVariables,
} from "./variables.js";
import type { HooksConfig } from "./types.js";

describe("variable transformation", () => {
	describe("transformToOmnidev", () => {
		test("transforms CLAUDE_PLUGIN_ROOT to OMNIDEV_CAPABILITY_ROOT with braces format", () => {
			const input = '"${CLAUDE_PLUGIN_ROOT}/hooks/script.sh"';
			const output = transformToOmnidev(input);
			expect(output).toBe('"${OMNIDEV_CAPABILITY_ROOT}/hooks/script.sh"');
		});

		test("transforms CLAUDE_PROJECT_DIR to OMNIDEV_PROJECT_DIR with braces format", () => {
			const input = '"${CLAUDE_PROJECT_DIR}/config.toml"';
			const output = transformToOmnidev(input);
			expect(output).toBe('"${OMNIDEV_PROJECT_DIR}/config.toml"');
		});

		test("transforms $CLAUDE_PLUGIN_ROOT format (without braces)", () => {
			const input = '"$CLAUDE_PLUGIN_ROOT/hooks/script.sh"';
			const output = transformToOmnidev(input);
			expect(output).toBe('"$OMNIDEV_CAPABILITY_ROOT/hooks/script.sh"');
		});

		test("transforms $CLAUDE_PROJECT_DIR format (without braces)", () => {
			const input = '"$CLAUDE_PROJECT_DIR/config.toml"';
			const output = transformToOmnidev(input);
			expect(output).toBe('"$OMNIDEV_PROJECT_DIR/config.toml"');
		});

		test("preserves unrelated variables", () => {
			const input = '"${HOME}/scripts/${USER}/run.sh"';
			const output = transformToOmnidev(input);
			expect(output).toBe('"${HOME}/scripts/${USER}/run.sh"');
		});

		test("handles multiple variables in same string", () => {
			const input = '"${CLAUDE_PLUGIN_ROOT}/hooks/script.sh && ${CLAUDE_PROJECT_DIR}/run.sh"';
			const output = transformToOmnidev(input);
			expect(output).toBe(
				'"${OMNIDEV_CAPABILITY_ROOT}/hooks/script.sh && ${OMNIDEV_PROJECT_DIR}/run.sh"',
			);
		});

		test("handles mixed variable formats", () => {
			const input = '"${CLAUDE_PLUGIN_ROOT}/hooks/script.sh $CLAUDE_PROJECT_DIR/run.sh"';
			const output = transformToOmnidev(input);
			expect(output).toBe(
				'"${OMNIDEV_CAPABILITY_ROOT}/hooks/script.sh $OMNIDEV_PROJECT_DIR/run.sh"',
			);
		});

		test("returns unchanged string when no Claude variables present", () => {
			const input = 'echo "hello world"';
			const output = transformToOmnidev(input);
			expect(output).toBe('echo "hello world"');
		});
	});

	describe("transformToClaude", () => {
		test("transforms OMNIDEV_CAPABILITY_ROOT to CLAUDE_PLUGIN_ROOT with ${} format", () => {
			const input = '"${OMNIDEV_CAPABILITY_ROOT}/hooks/script.sh"';
			const output = transformToClaude(input);
			expect(output).toBe('"${CLAUDE_PLUGIN_ROOT}/hooks/script.sh"');
		});

		test("transforms OMNIDEV_PROJECT_DIR to CLAUDE_PROJECT_DIR with ${} format", () => {
			const input = '"${OMNIDEV_PROJECT_DIR}/config.toml"';
			const output = transformToClaude(input);
			expect(output).toBe('"${CLAUDE_PROJECT_DIR}/config.toml"');
		});

		test("transforms $OMNIDEV_CAPABILITY_ROOT format (without braces)", () => {
			const input = '"$OMNIDEV_CAPABILITY_ROOT/hooks/script.sh"';
			const output = transformToClaude(input);
			expect(output).toBe('"$CLAUDE_PLUGIN_ROOT/hooks/script.sh"');
		});

		test("transforms $OMNIDEV_PROJECT_DIR format (without braces)", () => {
			const input = '"$OMNIDEV_PROJECT_DIR/config.toml"';
			const output = transformToClaude(input);
			expect(output).toBe('"$CLAUDE_PROJECT_DIR/config.toml"');
		});

		test("preserves unrelated variables", () => {
			const input = '"${HOME}/scripts/${USER}/run.sh"';
			const output = transformToClaude(input);
			expect(output).toBe('"${HOME}/scripts/${USER}/run.sh"');
		});

		test("handles multiple variables in same string", () => {
			const input = '"${OMNIDEV_CAPABILITY_ROOT}/hooks/script.sh && ${OMNIDEV_PROJECT_DIR}/run.sh"';
			const output = transformToClaude(input);
			expect(output).toBe(
				'"${CLAUDE_PLUGIN_ROOT}/hooks/script.sh && ${CLAUDE_PROJECT_DIR}/run.sh"',
			);
		});
	});

	describe("transformHooksConfig", () => {
		test("transforms command hooks to Claude format", () => {
			const config: HooksConfig = {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: '"${OMNIDEV_CAPABILITY_ROOT}/validate.sh"' }],
					},
				],
			};
			const result = transformHooksConfig(config, "toClaude");
			const transformed = result.PreToolUse?.[0]?.hooks[0];
			expect(transformed?.type).toBe("command");
			if (transformed?.type === "command") {
				expect(transformed.command).toBe('"${CLAUDE_PLUGIN_ROOT}/validate.sh"');
			}
		});

		test("transforms prompt hooks to Claude format", () => {
			const config: HooksConfig = {
				Stop: [
					{
						hooks: [{ type: "prompt", prompt: "Check at ${OMNIDEV_PROJECT_DIR}" }],
					},
				],
			};
			const result = transformHooksConfig(config, "toClaude");
			const transformed = result.Stop?.[0]?.hooks[0];
			expect(transformed?.type).toBe("prompt");
			if (transformed?.type === "prompt") {
				expect(transformed.prompt).toBe("Check at ${CLAUDE_PROJECT_DIR}");
			}
		});

		test("transforms config to OmniDev format", () => {
			const config: HooksConfig = {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: '"${CLAUDE_PLUGIN_ROOT}/validate.sh"' }],
					},
				],
			};
			const result = transformHooksConfig(config, "toOmnidev");
			const transformed = result.PreToolUse?.[0]?.hooks[0];
			expect(transformed?.type).toBe("command");
			if (transformed?.type === "command") {
				expect(transformed.command).toBe('"${OMNIDEV_CAPABILITY_ROOT}/validate.sh"');
			}
		});

		test("preserves description", () => {
			const config: HooksConfig = {
				description: "My hooks description",
				PreToolUse: [{ hooks: [{ type: "command", command: "echo test" }] }],
			};
			const result = transformHooksConfig(config, "toClaude");
			expect(result.description).toBe("My hooks description");
		});

		test("preserves other hook properties", () => {
			const config: HooksConfig = {
				PreToolUse: [
					{
						matcher: "Bash|Edit",
						hooks: [{ type: "command", command: "echo test", timeout: 30 }],
					},
				],
			};
			const result = transformHooksConfig(config, "toClaude");
			expect(result.PreToolUse?.[0]?.matcher).toBe("Bash|Edit");
			expect(result.PreToolUse?.[0]?.hooks[0]?.timeout).toBe(30);
		});
	});

	describe("containsClaudeVariables", () => {
		test("returns true for ${CLAUDE_PLUGIN_ROOT}", () => {
			expect(containsClaudeVariables("${CLAUDE_PLUGIN_ROOT}/script.sh")).toBe(true);
		});

		test("returns true for ${CLAUDE_PROJECT_DIR}", () => {
			expect(containsClaudeVariables("${CLAUDE_PROJECT_DIR}/config")).toBe(true);
		});

		test("returns true for $CLAUDE_PLUGIN_ROOT", () => {
			expect(containsClaudeVariables("$CLAUDE_PLUGIN_ROOT/script.sh")).toBe(true);
		});

		test("returns false for OMNIDEV variables", () => {
			expect(containsClaudeVariables("${OMNIDEV_CAPABILITY_ROOT}/script.sh")).toBe(false);
		});

		test("returns false for unrelated content", () => {
			expect(containsClaudeVariables("echo hello")).toBe(false);
		});
	});

	describe("containsOmnidevVariables", () => {
		test("returns true for ${OMNIDEV_CAPABILITY_ROOT}", () => {
			expect(containsOmnidevVariables("${OMNIDEV_CAPABILITY_ROOT}/script.sh")).toBe(true);
		});

		test("returns true for ${OMNIDEV_PROJECT_DIR}", () => {
			expect(containsOmnidevVariables("${OMNIDEV_PROJECT_DIR}/config")).toBe(true);
		});

		test("returns true for $OMNIDEV_CAPABILITY_ROOT", () => {
			expect(containsOmnidevVariables("$OMNIDEV_CAPABILITY_ROOT/script.sh")).toBe(true);
		});

		test("returns false for CLAUDE variables", () => {
			expect(containsOmnidevVariables("${CLAUDE_PLUGIN_ROOT}/script.sh")).toBe(false);
		});

		test("returns false for unrelated content", () => {
			expect(containsOmnidevVariables("echo hello")).toBe(false);
		});
	});
});
