// Capability Types
export interface CapabilityMetadata {
	id: string;
	name: string;
	version: string;
	description: string;
}

export interface CapabilityExports {
	module?: string;
	gitignore?: string[];
}

export interface EnvDeclaration {
	required?: boolean;
	secret?: boolean;
	default?: string;
}

export interface SyncConfig {
	on_sync?: string;
}

export interface CliConfig {
	commands?: string[];
}

export interface CapabilityConfig {
	capability: CapabilityMetadata;
	exports?: CapabilityExports;
	env?: Record<string, EnvDeclaration | Record<string, never>>;
	mcp?: McpConfig;
	sync?: SyncConfig;
	cli?: CliConfig;
}

export interface McpConfig {
	command: string;
	args?: string[];
	env?: Record<string, string>;
	cwd?: string;
	transport?: "stdio" | "sse";
}

// Content Types
export interface Skill {
	name: string;
	description: string;
	instructions: string;
	capabilityId: string;
}

export interface Rule {
	name: string;
	content: string;
	capabilityId: string;
}

export interface Doc {
	name: string;
	content: string;
	capabilityId: string;
}

// Config Types
export interface ProfileConfig {
	enable?: string[];
	disable?: string[];
}

export interface CapabilitiesConfig {
	enable?: string[];
	disable?: string[];
}

export interface CapabilitiesState {
	enabled?: string[];
	disabled?: string[];
}

export interface OmniConfig {
	project?: string;
	default_profile?: string;
	capabilities?: CapabilitiesConfig;
	env?: Record<string, string>;
	profiles?: Record<string, ProfileConfig>;
}

// Provider Types
export type Provider = "claude" | "codex";

export interface ProviderConfig {
	provider?: Provider;
	providers?: Provider[];
}

export function getActiveProviders(config: ProviderConfig): Provider[] {
	if (config.providers) return config.providers;
	if (config.provider) return [config.provider];
	return ["claude"]; // Default
}

// Loaded Capability
export interface LoadedCapability {
	id: string;
	path: string;
	config: CapabilityConfig;
	skills: Skill[];
	rules: Rule[];
	docs: Doc[];
	typeDefinitions?: string;
	gitignore?: string[];
	exports: Record<string, unknown>;
}
