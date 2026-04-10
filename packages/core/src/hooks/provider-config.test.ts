import { describe, expect, test } from "bun:test";
import type { CapabilityHooks } from "./types";
import { composeHooksForProvider } from "./provider-config";

function createCapabilityHooks(
	capabilityName: string,
	config: CapabilityHooks["config"],
	providerConfigs?: CapabilityHooks["providerConfigs"],
): CapabilityHooks {
	return {
		capabilityName,
		capabilityPath: `/capabilities/${capabilityName}`,
		config,
		...(providerConfigs ? { providerConfigs } : {}),
		validation: {
			valid: true,
			errors: [],
			warnings: [],
		},
	};
}

describe("composeHooksForProvider", () => {
	test("uses shared hooks for Claude Code and replaces events with [claude] overrides", () => {
		const capabilityHooks = [
			createCapabilityHooks(
				"test-cap",
				{
					PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo shared" }] }],
					Stop: [{ hooks: [{ type: "prompt", prompt: "shared stop" }] }],
				},
				{
					claude: {
						Stop: [
							{
								hooks: [{ type: "command", command: "echo claude-stop", timeout: 30 }],
							},
						],
					},
				},
			),
		];

		const result = composeHooksForProvider(capabilityHooks, "claude-code");
		expect(result.warnings).toEqual([]);
		expect(result.config.PreToolUse).toHaveLength(1);
		expect(result.config.Stop).toEqual([
			{
				hooks: [{ type: "command", command: "echo claude-stop", timeout: 30 }],
			},
		]);
	});

	test("includes Claude-native provider events in the composed Claude output", () => {
		const capabilityHooks = [
			createCapabilityHooks(
				"test-cap",
				{
					PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo shared" }] }],
				},
				{
					claude: {
						WorktreeCreate: [
							{
								hooks: [{ type: "command", command: "echo create-worktree" }],
							},
						],
						WorktreeRemove: [
							{
								hooks: [{ type: "command", command: "echo remove-worktree" }],
							},
						],
					},
				},
			),
		];

		const result = composeHooksForProvider(capabilityHooks, "claude-code");
		expect(result.warnings).toEqual([]);
		expect(result.config.WorktreeCreate).toEqual([
			{
				hooks: [{ type: "command", command: "echo create-worktree" }],
			},
		]);
		expect(result.config.WorktreeRemove).toEqual([
			{
				hooks: [{ type: "command", command: "echo remove-worktree" }],
			},
		]);
	});

	test("filters incompatible shared hooks for Codex and warns instead of failing", () => {
		const capabilityHooks = [
			createCapabilityHooks("test-cap", {
				PermissionRequest: [{ hooks: [{ type: "command", command: "echo permission" }] }],
				PreToolUse: [
					{ matcher: "Edit|Write", hooks: [{ type: "command", command: "echo skip" }] },
					{ matcher: "Bash", hooks: [{ type: "prompt", prompt: "should skip" }] },
					{ matcher: "Bash", hooks: [{ type: "command", command: "echo keep" }] },
				],
				Stop: [{ matcher: "SomePattern", hooks: [{ type: "command", command: "echo stop" }] }],
			}),
		];

		const result = composeHooksForProvider(capabilityHooks, "codex");
		expect(result.config.PermissionRequest).toBeUndefined();
		expect(result.config.PreToolUse).toEqual([
			{
				matcher: "Bash",
				hooks: [{ type: "command", command: "echo keep" }],
			},
		]);
		expect(result.config.Stop).toEqual([
			{
				hooks: [{ type: "command", command: "echo stop" }],
			},
		]);
		expect(result.warnings.some((warning) => warning.includes("PermissionRequest"))).toBe(true);
		expect(result.warnings.some((warning) => warning.includes("Edit|Write"))).toBe(true);
		expect(result.warnings.some((warning) => warning.includes("prompt hooks"))).toBe(true);
		expect(result.warnings.some((warning) => warning.includes("matcher was dropped"))).toBe(true);
	});

	test("replaces shared events with [codex] overrides and warns about [claude] sections", () => {
		const capabilityHooks = [
			createCapabilityHooks(
				"test-cap",
				{
					PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo shared" }] }],
					UserPromptSubmit: [{ hooks: [{ type: "command", command: "echo shared-prompt" }] }],
				},
				{
					codex: {
						PreToolUse: [
							{
								matcher: "Bash",
								hooks: [
									{
										type: "command",
										command: "echo codex",
										statusMessage: "Checking Bash command",
									},
								],
							},
						],
					},
					claude: {
						Stop: [{ hooks: [{ type: "prompt", prompt: "claude only" }] }],
					},
				},
			),
		];

		const result = composeHooksForProvider(capabilityHooks, "codex");
		expect(result.config.PreToolUse).toEqual([
			{
				matcher: "Bash",
				hooks: [
					{
						type: "command",
						command: "echo codex",
						statusMessage: "Checking Bash command",
					},
				],
			},
		]);
		expect(result.config.UserPromptSubmit).toEqual([
			{
				hooks: [{ type: "command", command: "echo shared-prompt" }],
			},
		]);
		expect(result.warnings.some((warning) => warning.includes("[claude] hooks"))).toBe(true);
	});

	test("skips all Codex hook output on Windows, including [codex] overrides", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", {
			value: "win32",
			configurable: true,
		});

		try {
			const capabilityHooks = [
				createCapabilityHooks(
					"test-cap",
					{},
					{
						codex: {
							PreToolUse: [
								{
									matcher: "Bash",
									hooks: [{ type: "command", command: "echo codex-only" }],
								},
							],
						},
					},
				),
			];

			const result = composeHooksForProvider(capabilityHooks, "codex");
			expect(result.config).toEqual({});
			expect(
				result.warnings.some(
					(warning) =>
						warning.includes("disabled on Windows") && warning.includes('Capability "test-cap"'),
				),
			).toBe(true);
		} finally {
			Object.defineProperty(process, "platform", {
				value: originalPlatform,
				configurable: true,
			});
		}
	});
});
