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
	const mcpNeedsResolution = config.mcp ? mcpHasPlaceholders(config.mcp) : false;
	const namedMcpsNeedingResolution = Object.entries(config.mcps ?? {}).filter(([, mcp]) =>
		mcpHasPlaceholders(mcp),
	);

	if (!mcpNeedsResolution && namedMcpsNeedingResolution.length === 0) {
		return config;
	}

	const resolvedVariables = variables ?? (await loadCapabilityEnvVariables(capabilityPath));
	const capabilityId = config.capability.id;

	const resolveMcp = (mcp: McpConfig, fieldPrefix: string): McpConfig => {
		const resolvedMcp: McpConfig = { ...mcp };

		if (resolvedMcp.command) {
			resolvedMcp.command = resolveString(
				resolvedMcp.command,
				resolvedVariables,
				capabilityId,
				`${fieldPrefix}.command`,
			);
		}

		if (resolvedMcp.cwd) {
			resolvedMcp.cwd = resolveString(
				resolvedMcp.cwd,
				resolvedVariables,
				capabilityId,
				`${fieldPrefix}.cwd`,
			);
		}

		if (resolvedMcp.url) {
			resolvedMcp.url = resolveString(
				resolvedMcp.url,
				resolvedVariables,
				capabilityId,
				`${fieldPrefix}.url`,
			);
		}

		if (resolvedMcp.args) {
			resolvedMcp.args = resolvedMcp.args.map((arg, index) =>
				resolveString(arg, resolvedVariables, capabilityId, `${fieldPrefix}.args[${index}]`),
			);
		}

		if (resolvedMcp.env) {
			resolvedMcp.env = Object.fromEntries(
				Object.entries(resolvedMcp.env).map(([key, value]) => [
					key,
					resolveString(value, resolvedVariables, capabilityId, `${fieldPrefix}.env.${key}`),
				]),
			);
		}

		if (resolvedMcp.headers) {
			resolvedMcp.headers = Object.fromEntries(
				Object.entries(resolvedMcp.headers).map(([key, value]) => [
					key,
					resolveString(value, resolvedVariables, capabilityId, `${fieldPrefix}.headers.${key}`),
				]),
			);
		}

		return resolvedMcp;
	};

	const resolvedMcps = config.mcps ? { ...config.mcps } : undefined;
	for (const [name, mcp] of namedMcpsNeedingResolution) {
		if (resolvedMcps) {
			resolvedMcps[name] = resolveMcp(mcp, `mcps.${name}`);
		}
	}

	const resolvedConfig: CapabilityConfig = { ...config };
	if (config.mcp && mcpNeedsResolution) {
		resolvedConfig.mcp = resolveMcp(config.mcp, "mcp");
	}
	if (resolvedMcps) {
		resolvedConfig.mcps = resolvedMcps;
	}

	return resolvedConfig;
}
