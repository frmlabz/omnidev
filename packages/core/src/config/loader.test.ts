import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { loadConfig } from './loader';

const TEST_DIR = '/tmp/omnidev-test-loader';
const TEAM_CONFIG = 'omni/config.toml';
const LOCAL_CONFIG = '.omni/config.local.toml';

// Save and restore the current working directory
let originalCwd: string;

beforeEach(() => {
	// Save original cwd
	originalCwd = process.cwd();

	// Clean up test directory
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
	mkdirSync(TEST_DIR, { recursive: true });
	process.chdir(TEST_DIR);
});

afterEach(() => {
	// Restore original cwd
	process.chdir(originalCwd);

	// Clean up test directory
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
});

describe('loadConfig', () => {
	test('returns empty config when no files exist', async () => {
		const config = await loadConfig();
		expect(config).toEqual({
			capabilities: {
				enable: [],
				disable: [],
			},
			env: {},
			profiles: {},
		});
	});

	test('loads team config when only team config exists', async () => {
		mkdirSync('omni', { recursive: true });
		writeFileSync(
			TEAM_CONFIG,
			`
project = "my-project"
default_profile = "dev"

[capabilities]
enable = ["tasks", "git"]
`,
		);

		const config = await loadConfig();
		expect(config.project).toBe('my-project');
		expect(config.default_profile).toBe('dev');
		expect(config.capabilities?.enable).toEqual(['tasks', 'git']);
	});

	test('loads local config when only local config exists', async () => {
		mkdirSync('.omni', { recursive: true });
		writeFileSync(
			LOCAL_CONFIG,
			`
project = "local-project"

[capabilities]
enable = ["local-only"]
`,
		);

		const config = await loadConfig();
		expect(config.project).toBe('local-project');
		expect(config.capabilities?.enable).toEqual(['local-only']);
	});

	test('merges team and local configs with local taking precedence', async () => {
		mkdirSync('omni', { recursive: true });
		mkdirSync('.omni', { recursive: true });

		writeFileSync(
			TEAM_CONFIG,
			`
project = "team-project"
default_profile = "production"

[capabilities]
enable = ["tasks"]
disable = []

[env]
API_URL = "https://team-api.com"
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
project = "local-override"

[capabilities]
enable = ["git"]

[env]
API_URL = "http://localhost:3000"
DEBUG = "true"
`,
		);

		const config = await loadConfig();

		// Local overrides should take precedence
		expect(config.project).toBe('local-override');

		// Capabilities should be merged (both team and local enable arrays)
		expect(config.capabilities?.enable).toEqual(['tasks', 'git']);

		// Env should be merged with local taking precedence
		expect(config.env?.API_URL).toBe('http://localhost:3000');
		expect(config.env?.DEBUG).toBe('true');
	});

	test('merges capabilities enable arrays', async () => {
		mkdirSync('omni', { recursive: true });
		mkdirSync('.omni', { recursive: true });

		writeFileSync(
			TEAM_CONFIG,
			`
[capabilities]
enable = ["tasks", "git"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities]
enable = ["local-capability"]
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.enable).toEqual(['tasks', 'git', 'local-capability']);
	});

	test('merges capabilities disable arrays', async () => {
		mkdirSync('omni', { recursive: true });
		mkdirSync('.omni', { recursive: true });

		writeFileSync(
			TEAM_CONFIG,
			`
[capabilities]
disable = ["experimental"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[capabilities]
disable = ["deprecated"]
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.disable).toEqual(['experimental', 'deprecated']);
	});

	test('merges profiles with local taking precedence', async () => {
		mkdirSync('omni', { recursive: true });
		mkdirSync('.omni', { recursive: true });

		writeFileSync(
			TEAM_CONFIG,
			`
[profiles.dev]
enable = ["tasks"]

[profiles.prod]
enable = ["git"]
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[profiles.dev]
enable = ["local-tasks"]
`,
		);

		const config = await loadConfig();
		expect(config.profiles?.dev?.enable).toEqual(['local-tasks']);
		expect(config.profiles?.prod?.enable).toEqual(['git']);
	});

	test('handles empty capabilities sections gracefully', async () => {
		mkdirSync('omni', { recursive: true });
		writeFileSync(
			TEAM_CONFIG,
			`
project = "test"
`,
		);

		const config = await loadConfig();
		expect(config.capabilities?.enable).toEqual([]);
		expect(config.capabilities?.disable).toEqual([]);
	});

	test('handles invalid TOML in team config', async () => {
		mkdirSync('omni', { recursive: true });
		writeFileSync(TEAM_CONFIG, 'invalid toml [[[');

		await expect(loadConfig()).rejects.toThrow('Invalid TOML in config');
	});

	test('handles invalid TOML in local config', async () => {
		mkdirSync('.omni', { recursive: true });
		writeFileSync(LOCAL_CONFIG, 'invalid toml [[[');

		await expect(loadConfig()).rejects.toThrow('Invalid TOML in config');
	});

	test('merges env objects correctly', async () => {
		mkdirSync('omni', { recursive: true });
		mkdirSync('.omni', { recursive: true });

		writeFileSync(
			TEAM_CONFIG,
			`
[env]
VAR1 = "team1"
VAR2 = "team2"
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
[env]
VAR2 = "local2"
VAR3 = "local3"
`,
		);

		const config = await loadConfig();
		expect(config.env?.VAR1).toBe('team1');
		expect(config.env?.VAR2).toBe('local2');
		expect(config.env?.VAR3).toBe('local3');
	});

	test('preserves default_profile from team when not in local', async () => {
		mkdirSync('omni', { recursive: true });
		mkdirSync('.omni', { recursive: true });

		writeFileSync(
			TEAM_CONFIG,
			`
default_profile = "production"
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
project = "local"
`,
		);

		const config = await loadConfig();
		expect(config.default_profile).toBe('production');
	});

	test('overrides default_profile with local value', async () => {
		mkdirSync('omni', { recursive: true });
		mkdirSync('.omni', { recursive: true });

		writeFileSync(
			TEAM_CONFIG,
			`
default_profile = "production"
`,
		);

		writeFileSync(
			LOCAL_CONFIG,
			`
default_profile = "development"
`,
		);

		const config = await loadConfig();
		expect(config.default_profile).toBe('development');
	});
});
