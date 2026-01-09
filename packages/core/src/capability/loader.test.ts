import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverCapabilities, loadCapabilityConfig } from './loader';

describe('discoverCapabilities', () => {
	const testDir = 'test-capabilities-discovery';
	const capabilitiesDir = join(testDir, 'omni', 'capabilities');
	let originalCwd: string;

	beforeEach(() => {
		// Save current working directory
		originalCwd = process.cwd();

		// Create test directory structure
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(capabilitiesDir, { recursive: true });

		// Change to test directory
		process.chdir(testDir);
	});

	afterEach(() => {
		// Restore working directory
		process.chdir(originalCwd);

		// Cleanup
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test('returns empty array when capabilities directory does not exist', async () => {
		// Remove the capabilities directory
		rmSync('omni/capabilities', { recursive: true, force: true });

		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual([]);
	});

	test('returns empty array when capabilities directory is empty', async () => {
		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual([]);
	});

	test('discovers a single capability with capability.toml', async () => {
		// Create a capability directory with capability.toml
		const capPath = join('omni', 'capabilities', 'test-cap');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(join(capPath, 'capability.toml'), '[capability]\nid = "test-cap"');

		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual(['omni/capabilities/test-cap']);
	});

	test('discovers multiple capabilities with capability.toml', async () => {
		// Create multiple capability directories
		const cap1Path = join('omni', 'capabilities', 'capability-1');
		const cap2Path = join('omni', 'capabilities', 'capability-2');
		const cap3Path = join('omni', 'capabilities', 'capability-3');

		mkdirSync(cap1Path, { recursive: true });
		mkdirSync(cap2Path, { recursive: true });
		mkdirSync(cap3Path, { recursive: true });

		writeFileSync(join(cap1Path, 'capability.toml'), '[capability]\nid = "capability-1"');
		writeFileSync(join(cap2Path, 'capability.toml'), '[capability]\nid = "capability-2"');
		writeFileSync(join(cap3Path, 'capability.toml'), '[capability]\nid = "capability-3"');

		const capabilities = await discoverCapabilities();

		expect(capabilities).toHaveLength(3);
		expect(capabilities).toContain('omni/capabilities/capability-1');
		expect(capabilities).toContain('omni/capabilities/capability-2');
		expect(capabilities).toContain('omni/capabilities/capability-3');
	});

	test('ignores directories without capability.toml', async () => {
		// Create directory without capability.toml
		const notACapPath = join('omni', 'capabilities', 'not-a-capability');
		mkdirSync(notACapPath, { recursive: true });
		writeFileSync(join(notACapPath, 'README.md'), '# Not a capability');

		// Create a valid capability
		const validCapPath = join('omni', 'capabilities', 'valid-cap');
		mkdirSync(validCapPath, { recursive: true });
		writeFileSync(join(validCapPath, 'capability.toml'), '[capability]\nid = "valid-cap"');

		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual(['omni/capabilities/valid-cap']);
	});

	test('ignores files in capabilities directory', async () => {
		// Create a file in the capabilities directory (not a subdirectory)
		writeFileSync(join('omni', 'capabilities', 'README.md'), '# Capabilities');

		// Create a valid capability
		const validCapPath = join('omni', 'capabilities', 'valid-cap');
		mkdirSync(validCapPath, { recursive: true });
		writeFileSync(join(validCapPath, 'capability.toml'), '[capability]\nid = "valid-cap"');

		const capabilities = await discoverCapabilities();

		expect(capabilities).toEqual(['omni/capabilities/valid-cap']);
	});

	test('handles nested directories correctly (does not recurse)', async () => {
		// Create a nested structure - should only discover top-level capabilities
		const cap1Path = join('omni', 'capabilities', 'capability-1');
		const nestedCapPath = join(cap1Path, 'nested-capability');

		mkdirSync(cap1Path, { recursive: true });
		mkdirSync(nestedCapPath, { recursive: true });

		writeFileSync(join(cap1Path, 'capability.toml'), '[capability]\nid = "capability-1"');
		writeFileSync(join(nestedCapPath, 'capability.toml'), '[capability]\nid = "nested"');

		const capabilities = await discoverCapabilities();

		// Should only find the top-level capability, not the nested one
		expect(capabilities).toEqual(['omni/capabilities/capability-1']);
	});

	test('returns paths in consistent format', async () => {
		const capPath = join('omni', 'capabilities', 'test-cap');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(join(capPath, 'capability.toml'), '[capability]\nid = "test-cap"');

		const capabilities = await discoverCapabilities();

		// Path should use forward slashes or be normalized
		expect(capabilities[0]).toMatch(/^omni\/capabilities\/test-cap$/);
	});
});

describe('loadCapabilityConfig', () => {
	const testDir = 'test-capability-config-loading';
	const capabilitiesDir = join(testDir, 'omni', 'capabilities');
	let originalCwd: string;

	beforeEach(() => {
		// Save current working directory
		originalCwd = process.cwd();

		// Create test directory structure
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(capabilitiesDir, { recursive: true });

		// Change to test directory
		process.chdir(testDir);
	});

	afterEach(() => {
		// Restore working directory
		process.chdir(originalCwd);

		// Cleanup
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test('loads valid capability config with all required fields', async () => {
		const capPath = join('omni', 'capabilities', 'test-cap');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "test-cap"
name = "Test Capability"
version = "1.0.0"
description = "A test capability"`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe('test-cap');
		expect(config.capability.name).toBe('Test Capability');
		expect(config.capability.version).toBe('1.0.0');
		expect(config.capability.description).toBe('A test capability');
	});

	test('loads capability config with optional exports field', async () => {
		const capPath = join('omni', 'capabilities', 'with-exports');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "with-exports"
name = "With Exports"
version = "1.0.0"
description = "Has exports"

[exports]
functions = ["create", "list", "get"]`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe('with-exports');
		expect(config.exports?.functions).toEqual(['create', 'list', 'get']);
	});

	test('loads capability config with optional env field', async () => {
		const capPath = join('omni', 'capabilities', 'with-env');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "with-env"
name = "With Env"
version = "1.0.0"
description = "Has env vars"

[[env]]
key = "API_KEY"
description = "API key"
required = true
secret = true`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe('with-env');
		expect(config.env).toBeDefined();
		expect(config.env?.[0]?.key).toBe('API_KEY');
		expect(config.env?.[0]?.required).toBe(true);
		expect(config.env?.[0]?.secret).toBe(true);
	});

	test('loads capability config with optional mcp field', async () => {
		const capPath = join('omni', 'capabilities', 'with-mcp');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "with-mcp"
name = "With MCP"
version = "1.0.0"
description = "Has MCP tools"

[mcp]
tools = ["test_tool"]`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe('with-mcp');
		expect(config.mcp?.tools).toEqual(['test_tool']);
	});

	test('throws error for reserved capability name (fs)', async () => {
		const capPath = join('omni', 'capabilities', 'fs');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "fs"
name = "File System"
version = "1.0.0"
description = "Reserved name"`,
		);

		expect(async () => await loadCapabilityConfig(capPath)).toThrow(
			'Capability name "fs" is reserved. Choose a different name.',
		);
	});

	test('throws error for reserved capability name (react)', async () => {
		const capPath = join('omni', 'capabilities', 'react-cap');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "react"
name = "React"
version = "1.0.0"
description = "Reserved name"`,
		);

		expect(async () => await loadCapabilityConfig(capPath)).toThrow(
			'Capability name "react" is reserved. Choose a different name.',
		);
	});

	test('throws error for reserved capability name (typescript)', async () => {
		const capPath = join('omni', 'capabilities', 'ts-cap');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "typescript"
name = "TypeScript"
version = "1.0.0"
description = "Reserved name"`,
		);

		expect(async () => await loadCapabilityConfig(capPath)).toThrow(
			'Capability name "typescript" is reserved. Choose a different name.',
		);
	});

	test('throws error when capability.toml is missing', async () => {
		const capPath = join('omni', 'capabilities', 'missing-config');
		mkdirSync(capPath, { recursive: true });

		// No capability.toml file created

		expect(async () => await loadCapabilityConfig(capPath)).toThrow();
	});

	test('throws error when capability.toml has missing required fields', async () => {
		const capPath = join('omni', 'capabilities', 'invalid');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "invalid"
# Missing name, version, description`,
		);

		expect(async () => await loadCapabilityConfig(capPath)).toThrow();
	});

	test('throws error when capability.toml has invalid TOML syntax', async () => {
		const capPath = join('omni', 'capabilities', 'bad-toml');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability
id = "bad-toml"
# Missing closing bracket`,
		);

		expect(async () => await loadCapabilityConfig(capPath)).toThrow();
	});

	test('allows non-reserved capability names', async () => {
		const capPath = join('omni', 'capabilities', 'my-custom-capability');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "my-custom-capability"
name = "My Custom Capability"
version = "2.1.0"
description = "A custom capability"`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe('my-custom-capability');
		expect(config.capability.name).toBe('My Custom Capability');
	});

	test('handles capability config with all optional fields defined', async () => {
		const capPath = join('omni', 'capabilities', 'complete-cap');
		mkdirSync(capPath, { recursive: true });
		writeFileSync(
			join(capPath, 'capability.toml'),
			`[capability]
id = "complete-cap"
name = "Complete Capability"
version = "1.0.0"
description = "Has all fields"

[exports]
functions = ["fn1", "fn2"]

[[env]]
key = "VAR1"
description = "Variable 1"
required = true
secret = false

[[env]]
key = "VAR2"
description = "Variable 2"
required = false
secret = true

[mcp]
tools = ["tool1", "tool2"]`,
		);

		const config = await loadCapabilityConfig(capPath);

		expect(config.capability.id).toBe('complete-cap');
		expect(config.exports?.functions).toEqual(['fn1', 'fn2']);
		expect(config.env).toHaveLength(2);
		expect(config.mcp?.tools).toEqual(['tool1', 'tool2']);
	});
});
