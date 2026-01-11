import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { EnvDeclaration } from "../types";
import { isSecretEnvVar, loadEnvironment, validateEnv } from "./env";

describe("loadEnvironment", () => {
	const originalCwd = process.cwd();
	const testDir = "/tmp/omnidev-test-env";

	beforeEach(() => {
		// Clean up and create test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	test("returns empty object when no .omni/.env file exists", async () => {
		const env = await loadEnvironment();
		// Should only contain process.env vars, no custom ones
		expect(env).toBeDefined();
	});

	test("loads environment variables from .omni/.env", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(".omni/.env", "TEST_VAR=test_value\nANOTHER_VAR=another_value");

		const env = await loadEnvironment();

		expect(env.TEST_VAR).toBe("test_value");
		expect(env.ANOTHER_VAR).toBe("another_value");
	});

	test("skips empty lines in .env file", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(".omni/.env", "VAR1=value1\n\n\nVAR2=value2");

		const env = await loadEnvironment();

		expect(env.VAR1).toBe("value1");
		expect(env.VAR2).toBe("value2");
	});

	test("skips comment lines in .env file", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(".omni/.env", "# This is a comment\nVAR1=value1\n# Another comment\nVAR2=value2");

		const env = await loadEnvironment();

		expect(env.VAR1).toBe("value1");
		expect(env.VAR2).toBe("value2");
		expect(env["# This is a comment"]).toBeUndefined();
	});

	test("handles values with equals signs", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(".omni/.env", "DATABASE_URL=postgres://user:pass@localhost:5432/db?param=value");

		const env = await loadEnvironment();

		expect(env.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/db?param=value");
	});

	test("handles quoted values", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			".omni/.env",
			"SINGLE_QUOTED='single value'\nDOUBLE_QUOTED=\"double value\"\nUNQUOTED=unquoted value",
		);

		const env = await loadEnvironment();

		expect(env.SINGLE_QUOTED).toBe("single value");
		expect(env.DOUBLE_QUOTED).toBe("double value");
		expect(env.UNQUOTED).toBe("unquoted value");
	});

	test("trims whitespace around keys and values", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(".omni/.env", "  VAR1  =  value1  \n\tVAR2\t=\tvalue2\t");

		const env = await loadEnvironment();

		expect(env.VAR1).toBe("value1");
		expect(env.VAR2).toBe("value2");
	});

	test("process.env takes precedence over .env file", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(".omni/.env", "TEST_VAR=file_value");

		// Set process env
		process.env.TEST_VAR = "process_value";

		const env = await loadEnvironment();

		expect(env.TEST_VAR).toBe("process_value");

		// Clean up
		delete process.env.TEST_VAR;
	});

	test("includes all process.env variables", async () => {
		process.env.CUSTOM_VAR = "custom_value";

		const env = await loadEnvironment();

		expect(env.CUSTOM_VAR).toBe("custom_value");

		// Clean up
		delete process.env.CUSTOM_VAR;
	});

	test("handles malformed lines gracefully", async () => {
		mkdirSync(".omni", { recursive: true });
		writeFileSync(
			".omni/.env",
			"VALID_VAR=value\nMALFORMED_LINE_NO_EQUALS\n=NO_KEY\nANOTHER_VAR=value2",
		);

		const env = await loadEnvironment();

		expect(env.VALID_VAR).toBe("value");
		expect(env.ANOTHER_VAR).toBe("value2");
		expect(env.MALFORMED_LINE_NO_EQUALS).toBeUndefined();
		expect(env[""]).toBeUndefined();
	});
});

describe("validateEnv", () => {
	test("passes validation when all required vars are present", () => {
		const declarations: Record<string, EnvDeclaration> = {
			API_KEY: { required: true },
			DATABASE_URL: { required: true },
		};

		const env = {
			API_KEY: "test-key",
			DATABASE_URL: "postgres://localhost",
		};

		expect(() => validateEnv(declarations, env, "test-capability")).not.toThrow();
	});

	test("passes validation when required var has default value", () => {
		const declarations: Record<string, EnvDeclaration> = {
			PORT: { required: true, default: "3000" },
		};

		const env = {};

		expect(() => validateEnv(declarations, env, "test-capability")).not.toThrow();
	});

	test("throws error when required var is missing", () => {
		const declarations: Record<string, EnvDeclaration> = {
			API_KEY: { required: true },
		};

		const env = {};

		expect(() => validateEnv(declarations, env, "test-capability")).toThrow(
			'Missing required environment variable for capability "test-capability": API_KEY. Set it in .omni/.env or as environment variable.',
		);
	});

	test("throws error with multiple missing vars", () => {
		const declarations: Record<string, EnvDeclaration> = {
			API_KEY: { required: true },
			DATABASE_URL: { required: true },
			SECRET_KEY: { required: true },
		};

		const env = {};

		expect(() => validateEnv(declarations, env, "test-capability")).toThrow(
			'Missing required environment variables for capability "test-capability": API_KEY, DATABASE_URL, SECRET_KEY',
		);
	});

	test("passes validation when optional vars are missing", () => {
		const declarations: Record<string, EnvDeclaration> = {
			API_KEY: { required: true },
			OPTIONAL_VAR: { required: false },
		};

		const env = {
			API_KEY: "test-key",
		};

		expect(() => validateEnv(declarations, env, "test-capability")).not.toThrow();
	});

	test("passes validation when no declarations are provided", () => {
		const declarations: Record<string, EnvDeclaration> = {};
		const env = {};

		expect(() => validateEnv(declarations, env, "test-capability")).not.toThrow();
	});

	test("handles empty object declarations", () => {
		const declarations: Record<string, EnvDeclaration | Record<string, never>> = {
			VAR1: {},
			VAR2: { required: true },
		};

		const env = {
			VAR2: "value",
		};

		expect(() => validateEnv(declarations, env, "test-capability")).not.toThrow();
	});

	test("uses default value when env var is missing", () => {
		const declarations: Record<string, EnvDeclaration> = {
			PORT: { required: true, default: "3000" },
			HOST: { required: true, default: "localhost" },
		};

		const env = {
			PORT: "8080", // Override default
		};

		expect(() => validateEnv(declarations, env, "test-capability")).not.toThrow();
	});
});

describe("isSecretEnvVar", () => {
	test("returns true when var is marked as secret", () => {
		const declarations: Record<string, EnvDeclaration> = {
			API_KEY: { secret: true },
		};

		expect(isSecretEnvVar("API_KEY", declarations)).toBe(true);
	});

	test("returns false when var is not marked as secret", () => {
		const declarations: Record<string, EnvDeclaration> = {
			PORT: { secret: false },
		};

		expect(isSecretEnvVar("PORT", declarations)).toBe(false);
	});

	test("returns false when var is not declared", () => {
		const declarations: Record<string, EnvDeclaration> = {};

		expect(isSecretEnvVar("UNKNOWN_VAR", declarations)).toBe(false);
	});

	test("returns false when secret field is not set", () => {
		const declarations: Record<string, EnvDeclaration> = {
			DATABASE_URL: { required: true },
		};

		expect(isSecretEnvVar("DATABASE_URL", declarations)).toBe(false);
	});

	test("handles empty object declarations", () => {
		const declarations: Record<string, EnvDeclaration | Record<string, never>> = {
			VAR1: {},
		};

		expect(isSecretEnvVar("VAR1", declarations)).toBe(false);
	});

	test("returns true only when secret is explicitly true", () => {
		const declarations: Record<string, EnvDeclaration> = {
			SECRET_KEY: { secret: true, required: true },
			API_KEY: { required: true },
			PORT: { secret: false },
		};

		expect(isSecretEnvVar("SECRET_KEY", declarations)).toBe(true);
		expect(isSecretEnvVar("API_KEY", declarations)).toBe(false);
		expect(isSecretEnvVar("PORT", declarations)).toBe(false);
	});
});
