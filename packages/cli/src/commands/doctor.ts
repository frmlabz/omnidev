import { existsSync } from "node:fs";
import { buildCommand } from "@stricli/core";

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

	const checks = [
		checkBunVersion(),
		checkOmniLocalDir(),
		checkConfig(),
		checkRootGitignore(),
		checkCapabilitiesDir(),
	];

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
	const configPath = "omni.toml";
	if (!existsSync(configPath)) {
		return {
			name: "Configuration",
			passed: false,
			message: "omni.toml not found",
			fix: "Run: omnidev init",
		};
	}

	try {
		const { loadConfig } = await import("@omnidev-ai/core");
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
			fix: "Check omni.toml syntax",
		};
	}
}

async function checkRootGitignore(): Promise<Check> {
	const gitignorePath = ".gitignore";
	if (!existsSync(gitignorePath)) {
		return {
			name: "Root .gitignore",
			passed: false,
			message: ".gitignore not found",
			fix: "Run: omnidev init",
		};
	}

	const content = await Bun.file(gitignorePath).text();
	const lines = content.split("\n").map((line) => line.trim());
	const hasOmniDir = lines.includes(".omni/");
	const hasLocalToml = lines.includes("omni.local.toml");

	if (!hasOmniDir || !hasLocalToml) {
		const missing: string[] = [];
		if (!hasOmniDir) missing.push(".omni/");
		if (!hasLocalToml) missing.push("omni.local.toml");
		return {
			name: "Root .gitignore",
			passed: false,
			message: `Missing entries: ${missing.join(", ")}`,
			fix: "Run: omnidev init",
		};
	}

	return {
		name: "Root .gitignore",
		passed: true,
		message: "Found with OmniDev entries",
	};
}

async function checkCapabilitiesDir(): Promise<Check> {
	const capabilitiesDirPath = ".omni/capabilities";
	if (!existsSync(capabilitiesDirPath)) {
		return {
			name: "Capabilities Directory",
			passed: true,
			message: "Not found (no custom capabilities)",
		};
	}

	return {
		name: "Capabilities Directory",
		passed: true,
		message: "Found",
	};
}
