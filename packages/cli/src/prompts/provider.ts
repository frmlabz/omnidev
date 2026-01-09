import { checkbox } from "@inquirer/prompts";
import type { Provider } from "@omnidev/core";

export async function promptForProvider(): Promise<Provider[]> {
	const answers = await checkbox({
		message: "Select your AI provider(s):",
		choices: [
			{ name: "Claude (recommended)", value: "claude", checked: true },
			{ name: "Codex", value: "codex", checked: false },
		],
		required: true,
	});

	return answers as Provider[];
}
