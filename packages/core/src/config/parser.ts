import { parse } from "smol-toml";
import type { CapabilityConfig, OmniConfig } from "../types";

/**
 * Parse a TOML string into an OmniConfig object
 * @param tomlContent - The TOML content to parse
 * @returns Parsed OmniConfig object
 * @throws Error if TOML is invalid
 */
export function parseOmniConfig(tomlContent: string): OmniConfig {
	try {
		return parse(tomlContent) as OmniConfig;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid TOML in config: ${message}`);
	}
}

/**
 * Validate that parsed TOML has required capability fields
 */
function validateCapabilityConfig(parsed: Record<string, unknown>): void {
	const cap = parsed["capability"];
	if (typeof cap !== "object" || cap === null) {
		throw new Error("capability.id is required in capability.toml");
	}
	const capability = cap as Record<string, unknown>;
	if (typeof capability["id"] !== "string") {
		throw new Error("capability.id is required in capability.toml");
	}
	if (typeof capability["name"] !== "string") {
		throw new Error("capability.name is required in capability.toml");
	}
	if (typeof capability["version"] !== "string") {
		throw new Error("capability.version is required in capability.toml");
	}
}

/**
 * Parse a TOML string into a CapabilityConfig object
 * @param tomlContent - The TOML content to parse
 * @returns Parsed CapabilityConfig object
 * @throws Error if TOML is invalid or required fields are missing
 */
export function parseCapabilityConfig(tomlContent: string): CapabilityConfig {
	try {
		const parsed = parse(tomlContent) as Record<string, unknown>;
		validateCapabilityConfig(parsed);
		// After validation, we know the structure matches CapabilityConfig
		return parsed as unknown as CapabilityConfig;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid capability.toml: ${message}`);
	}
}
