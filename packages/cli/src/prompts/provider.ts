import { checkbox, confirm } from "@inquirer/prompts";
import type { ProviderId } from "@omnidev-ai/core";

const PROVIDER_GITIGNORE_FILES: Record<string, string[]> = {
	"claude-code": ["CLAUDE.md", ".claude/", ".mcp.json"],
	cursor: [".cursor/"],
	codex: ["AGENTS.md", ".codex/"],
	opencode: [".opencode/"],
};

export function getProviderGitignoreFiles(providers: ProviderId[]): string[] {
	return providers.flatMap((p) => PROVIDER_GITIGNORE_FILES[p] ?? []);
}

export async function promptForProviders(): Promise<ProviderId[]> {
	const answers = await checkbox({
		message: "Select your AI provider(s):",
		choices: [
			{ name: "Claude Code (Claude CLI)", value: "claude-code", checked: true },
			{ name: "Cursor", value: "cursor", checked: false },
			{ name: "Codex", value: "codex", checked: false },
			{ name: "OpenCode", value: "opencode", checked: false },
		],
		required: true,
	});

	return answers as ProviderId[];
}

export async function promptForGitignoreProviderFiles(
	selectedProviders: ProviderId[],
): Promise<boolean> {
	const filesToIgnore = getProviderGitignoreFiles(selectedProviders);

	return confirm({
		message: `Add provider files to .gitignore? (${filesToIgnore.join(", ")})`,
		default: false,
	});
}
