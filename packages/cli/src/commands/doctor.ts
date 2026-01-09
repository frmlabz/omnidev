import { buildCommand } from "@stricli/core";
import { existsSync } from "node:fs";

export const doctorCommand = buildCommand({
	docs: {
		brief: "Check OmniDev setup and dependencies",
	},
	parameters: {},
	async func() {
		return await runDoctor();
	},
});

export async function runDoctor(): Promise<void> {
	console.log("OmniDev Doctor");
	console.log("==============");
	console.log("");

	const checks = [checkBunVersion(), checkOmniLocalDir(), checkConfig()];

	let allPassed = true;
	for (const check of checks) {
		const { name, passed, message, fix } = await check;
		const icon = passed ? "✓" : "✗";
		console.log(`${icon} ${name}: ${message}`);
		if (!passed && fix) {
			console.log(`  Fix: ${fix}`);
		}
		if (!passed) allPassed = false;
	}

	console.log("");
	if (allPassed) {
		console.log("All checks passed!");
	} else {
		console.log("Some checks failed. Please fix the issues above.");
		process.exit(1);
	}
}

interface Check {
	name: string;
	passed: boolean;
	message: string;
	fix?: string;
}

async function checkBunVersion(): Promise<Check> {
	const version = Bun.version;
	const parts = version.split(".");
	const firstPart = parts[0];
	if (!firstPart) {
		return {
			name: "Bun Version",
			passed: false,
			message: `Invalid version format: ${version}`,
			fix: "Reinstall Bun: curl -fsSL https://bun.sh/install | bash",
		};
	}
	const major = Number.parseInt(firstPart, 10);

	if (major < 1) {
		return {
			name: "Bun Version",
			passed: false,
			message: `v${version}`,
			fix: "Upgrade Bun: curl -fsSL https://bun.sh/install | bash",
		};
	}

	return {
		name: "Bun Version",
		passed: true,
		message: `v${version}`,
	};
}

async function checkOmniLocalDir(): Promise<Check> {
	const exists = existsSync(".omni");
	if (!exists) {
		return {
			name: ".omni/ directory",
			passed: false,
			message: "Not found",
			fix: "Run: omnidev init",
		};
	}

	return {
		name: ".omni/ directory",
		passed: true,
		message: "Found",
	};
}

async function checkConfig(): Promise<Check> {
	const configPath = ".omni/config.toml";
	if (!existsSync(configPath)) {
		return {
			name: "Configuration",
			passed: false,
			message: "config.toml not found",
			fix: "Run: omnidev init",
		};
	}

	try {
		const { loadConfig } = await import("@omnidev/core");
		await loadConfig();
		return {
			name: "Configuration",
			passed: true,
			message: "Valid",
		};
	} catch (error) {
		return {
			name: "Configuration",
			passed: false,
			message: `Invalid: ${error instanceof Error ? error.message : String(error)}`,
			fix: "Check .omni/config.toml syntax",
		};
	}
}
