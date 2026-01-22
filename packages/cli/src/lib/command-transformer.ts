/**
 * Command Transformer
 *
 * Transforms OmniDev capability commands to Stricli commands at load time.
 * This allows capabilities to define commands using a simpler OmniDev-native API
 * while the CLI uses Stricli internally.
 */

import { buildCommand, buildRouteMap } from "@stricli/core";
import type {
	CapabilityCommand,
	CapabilityRouteMap,
	CapabilityFlag,
	CapabilityPositional,
} from "@omnidev-ai/capability";
import { isCapabilityCommand, isCapabilityRouteMap } from "@omnidev-ai/capability";

/**
 * Transform an OmniDev flag to Stricli flag configuration.
 */
function transformFlag(flag: CapabilityFlag): Record<string, unknown> {
	const stricliFlag: Record<string, unknown> = {
		brief: flag.brief,
		optional: flag.optional ?? false,
	};

	// Map OmniDev kind to Stricli kind
	switch (flag.kind) {
		case "boolean":
			stricliFlag["kind"] = "boolean";
			break;
		case "string":
			stricliFlag["kind"] = "parsed";
			stricliFlag["parse"] = String;
			break;
		case "number":
			stricliFlag["kind"] = "parsed";
			stricliFlag["parse"] = Number;
			break;
		case "enum":
			stricliFlag["kind"] = "enum";
			stricliFlag["values"] = flag.values ?? [];
			break;
	}

	if (flag.default !== undefined) {
		stricliFlag["default"] = flag.default;
	}

	if (flag.variadic) {
		stricliFlag["variadic"] = true;
	}

	return stricliFlag;
}

/**
 * Transform OmniDev positional parameters to Stricli positional configuration.
 */
function transformPositionals(
	positionals: CapabilityPositional[],
): Record<string, unknown> | undefined {
	if (positionals.length === 0) {
		return undefined;
	}

	// For simplicity, we'll use tuple mode for positionals
	const parameters = positionals.map((pos) => {
		const param: Record<string, unknown> = {
			brief: pos.brief,
		};

		switch (pos.kind) {
			case "string":
				param["parse"] = String;
				break;
			case "number":
				param["parse"] = Number;
				break;
			case "enum":
				// For enum positionals, we need to validate values
				param["parse"] = (value: string) => {
					if (pos.values && !pos.values.includes(value)) {
						throw new Error(`Invalid value '${value}'. Expected one of: ${pos.values.join(", ")}`);
					}
					return value;
				};
				break;
		}

		return param;
	});

	// Check if we have optional positionals
	const hasOptional = positionals.some((p) => p.optional);

	if (hasOptional) {
		// Use array mode for optional positionals
		return {
			kind: "array",
			parameter: parameters[0], // Use the first positional config
		};
	}

	return {
		kind: "tuple",
		parameters,
	};
}

/**
 * Transform an OmniDev command to a Stricli command.
 */
export function transformCommand(cmd: CapabilityCommand): unknown {
	const parameters: Record<string, unknown> = {};

	// Transform flags
	if (cmd.parameters?.flags) {
		const stricliFlags: Record<string, unknown> = {};
		for (const [name, flag] of Object.entries(cmd.parameters.flags)) {
			stricliFlags[name] = transformFlag(flag);
		}
		parameters["flags"] = stricliFlags;
	} else {
		parameters["flags"] = {};
	}

	// Transform positional parameters
	if (cmd.parameters?.positional && cmd.parameters.positional.length > 0) {
		const positionalConfig = transformPositionals(cmd.parameters.positional);
		if (positionalConfig) {
			parameters["positional"] = positionalConfig;
		}
	}

	// Transform aliases
	if (cmd.parameters?.aliases) {
		parameters["aliases"] = cmd.parameters.aliases;
	}

	// Build the Stricli command
	return buildCommand({
		docs: {
			brief: cmd.brief,
			...(cmd.fullDescription ? { fullDescription: cmd.fullDescription } : {}),
		},
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic parameter transformation
		parameters: parameters as any,
		func: cmd.func,
	});
}

/**
 * Transform an OmniDev route map to a Stricli route map.
 */
export function transformRouteMap(routeMap: CapabilityRouteMap): unknown {
	const transformedRoutes: Record<string, unknown> = {};

	for (const [name, route] of Object.entries(routeMap.routes)) {
		if (isCapabilityCommand(route)) {
			transformedRoutes[name] = transformCommand(route);
		} else if (isCapabilityRouteMap(route)) {
			transformedRoutes[name] = transformRouteMap(route);
		} else {
			// Assume it's already a Stricli command/route (legacy format)
			transformedRoutes[name] = route;
		}
	}

	return buildRouteMap({
		// biome-ignore lint/suspicious/noExplicitAny: Dynamic route transformation
		routes: transformedRoutes as any,
		docs: {
			brief: routeMap.brief,
		},
	});
}

/**
 * Check if a command object uses the new OmniDev format.
 * OmniDev commands have a 'brief' property at the top level and a 'func' property.
 * OmniDev route maps have a 'brief' property and a 'routes' property.
 */
export function isOmniDevFormat(cmd: unknown): boolean {
	if (!cmd || typeof cmd !== "object") {
		return false;
	}
	return isCapabilityCommand(cmd) || isCapabilityRouteMap(cmd);
}

/**
 * Transform all capability commands from a capability export.
 * Handles both new OmniDev format and legacy Stricli format.
 */
export function transformCapabilityCommands(
	cliCommands: Record<string, unknown>,
): Record<string, unknown> {
	const transformed: Record<string, unknown> = {};

	for (const [name, cmd] of Object.entries(cliCommands)) {
		if (isCapabilityCommand(cmd)) {
			transformed[name] = transformCommand(cmd);
		} else if (isCapabilityRouteMap(cmd)) {
			transformed[name] = transformRouteMap(cmd);
		} else {
			// Legacy Stricli format - pass through unchanged
			transformed[name] = cmd;
		}
	}

	return transformed;
}
