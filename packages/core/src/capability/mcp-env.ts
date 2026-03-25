import type { CapabilityConfig, McpConfig } from "../types";
import { loadCapabilityEnvVariables } from "./env";

const ENV_PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const ENV_PLACEHOLDER_DETECTOR = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/;

function hasEnvPlaceholder(value: string): boolean {
	return ENV_PLACEHOLDER_DETECTOR.test(value);
}

function resolveString(
	value: string,
	variables: Record<string, string>,
	capabilityId: string,
	fieldPath: string,
): string {
	if (!hasEnvPlaceholder(value)) {
		return value;
	}

	return value.replace(ENV_PLACEHOLDER, (_match, variableName: string) => {
		const resolved = variables[variableName];
		if (resolved === undefined) {
			throw new Error(
				`Missing environment variable "${variableName}" required by capability "${capabilityId}" in ${fieldPath}`,
			);
		}
		return resolved;
	});
}

function mcpHasPlaceholders(mcp: McpConfig): boolean {
	const strings: string[] = [];

	if (mcp.command) {
		strings.push(mcp.command);
	}
	if (mcp.cwd) {
		strings.push(mcp.cwd);
	}
	if (mcp.url) {
		strings.push(mcp.url);
	}
	if (mcp.args) {
		strings.push(...mcp.args);
	}
	if (mcp.env) {
		strings.push(...Object.values(mcp.env));
	}
	if (mcp.headers) {
		strings.push(...Object.values(mcp.headers));
	}

	return strings.some((value) => hasEnvPlaceholder(value));
}

export async function resolveCapabilityMcpEnv(
	config: CapabilityConfig,
	capabilityPath: string,
	variables?: Record<string, string>,
): Promise<CapabilityConfig> {
	if (!config.mcp || !mcpHasPlaceholders(config.mcp)) {
		return config;
	}

	const resolvedVariables = variables ?? (await loadCapabilityEnvVariables(capabilityPath));
	const resolvedMcp: McpConfig = { ...config.mcp };
	const capabilityId = config.capability.id;

	if (resolvedMcp.command) {
		resolvedMcp.command = resolveString(
			resolvedMcp.command,
			resolvedVariables,
			capabilityId,
			"mcp.command",
		);
	}

	if (resolvedMcp.cwd) {
		resolvedMcp.cwd = resolveString(resolvedMcp.cwd, resolvedVariables, capabilityId, "mcp.cwd");
	}

	if (resolvedMcp.url) {
		resolvedMcp.url = resolveString(resolvedMcp.url, resolvedVariables, capabilityId, "mcp.url");
	}

	if (resolvedMcp.args) {
		resolvedMcp.args = resolvedMcp.args.map((arg, index) =>
			resolveString(arg, resolvedVariables, capabilityId, `mcp.args[${index}]`),
		);
	}

	if (resolvedMcp.env) {
		resolvedMcp.env = Object.fromEntries(
			Object.entries(resolvedMcp.env).map(([key, value]) => [
				key,
				resolveString(value, resolvedVariables, capabilityId, `mcp.env.${key}`),
			]),
		);
	}

	if (resolvedMcp.headers) {
		resolvedMcp.headers = Object.fromEntries(
			Object.entries(resolvedMcp.headers).map(([key, value]) => [
				key,
				resolveString(value, resolvedVariables, capabilityId, `mcp.headers.${key}`),
			]),
		);
	}

	return {
		...config,
		mcp: resolvedMcp,
	};
}
