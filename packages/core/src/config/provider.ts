import { existsSync } from "node:fs";
import { parse } from "@iarna/toml";
import type { Provider, ProviderConfig } from "../types/index.js";

const PROVIDER_CONFIG_PATH = ".omni/provider.toml";

export async function loadProviderConfig(): Promise<ProviderConfig> {
	if (!existsSync(PROVIDER_CONFIG_PATH)) {
		return { provider: "claude" };
	}

	const content = await Bun.file(PROVIDER_CONFIG_PATH).text();
	const parsed = parse(content) as ProviderConfig;
	return parsed;
}

export async function writeProviderConfig(config: ProviderConfig): Promise<void> {
	const lines: string[] = [];

	lines.push("# OmniDev Provider Configuration");
	lines.push("# Selected AI provider(s) for this project");
	lines.push("");

	if (config.providers && config.providers.length > 1) {
		lines.push("# Multiple providers enabled");
		lines.push(`providers = [${config.providers.map((p) => `"${p}"`).join(", ")}]`);
	} else if (config.providers && config.providers.length === 1) {
		lines.push("# Single provider");
		lines.push(`provider = "${config.providers[0]}"`);
	} else if (config.provider) {
		lines.push("# Single provider");
		lines.push(`provider = "${config.provider}"`);
	} else {
		lines.push("# Default: Claude");
		lines.push('provider = "claude"');
	}

	await Bun.write(PROVIDER_CONFIG_PATH, `${lines.join("\n")}\n`);
}

export function parseProviderFlag(flag: string): Provider[] {
	const lower = flag.toLowerCase();
	if (lower === "both") {
		return ["claude", "codex"];
	}
	if (lower === "claude" || lower === "codex") {
		return [lower as Provider];
	}
	throw new Error(`Invalid provider: ${flag}. Must be 'claude', 'codex', or 'both'.`);
}
