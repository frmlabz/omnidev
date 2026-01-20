/**
 * Mock factories for creating test data
 */

export interface MockCapability {
	id: string;
	name: string;
	version: string;
	enabled?: boolean;
	metadata?: Record<string, unknown>;
}

export interface MockConfig {
	project: string;
	capabilities: {
		enable: string[];
		disable?: string[];
	};
	profiles?: Record<string, unknown>;
}

export interface MockSkill {
	id: string;
	name: string;
	description: string;
	instructions: string;
	triggers?: string[];
}

export interface MockRule {
	id: string;
	name: string;
	content: string;
	priority?: number;
}

/**
 * Creates a mock capability with default values
 * @param overrides - Partial capability object to override defaults
 * @returns Mock capability object
 */
export function createMockCapability(overrides: Partial<MockCapability> = {}): MockCapability {
	return {
		id: "test-capability",
		name: "Test Capability",
		version: "1.0.0",
		enabled: true,
		metadata: {},
		...overrides,
	};
}

/**
 * Creates a mock config with default values
 * @param overrides - Partial config object to override defaults
 * @returns Mock config object
 */
export function createMockConfig(overrides: Partial<MockConfig> = {}): MockConfig {
	return {
		project: "test-project",
		capabilities: {
			enable: [],
			disable: [],
		},
		profiles: {},
		...overrides,
	};
}

/**
 * Creates a mock skill with default values
 * @param overrides - Partial skill object to override defaults
 * @returns Mock skill object
 */
export function createMockSkill(overrides: Partial<MockSkill> = {}): MockSkill {
	return {
		id: "test-skill",
		name: "Test Skill",
		description: "A test skill for unit testing",
		instructions: "Test instructions",
		triggers: [],
		...overrides,
	};
}

/**
 * Creates a mock rule with default values
 * @param overrides - Partial rule object to override defaults
 * @returns Mock rule object
 */
export function createMockRule(overrides: Partial<MockRule> = {}): MockRule {
	return {
		id: "test-rule",
		name: "Test Rule",
		content: "# Test Rule\n\nTest rule content",
		priority: 1,
		...overrides,
	};
}
