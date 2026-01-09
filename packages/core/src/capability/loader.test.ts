import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverCapabilities } from './loader';

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
