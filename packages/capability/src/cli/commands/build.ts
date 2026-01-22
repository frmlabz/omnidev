/**
 * capability build command
 *
 * Builds a capability's TypeScript code using esbuild.
 */

import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

export interface BuildCommandOptions {
	watch?: boolean | undefined;
}

/**
 * Find the entry point for the capability.
 * Returns the path to index.ts or index.js if found.
 */
function findEntryPoint(dir: string): string | null {
	const tsEntry = join(dir, "index.ts");
	const jsEntry = join(dir, "index.js");

	if (existsSync(tsEntry)) {
		return tsEntry;
	}
	if (existsSync(jsEntry)) {
		return jsEntry;
	}
	return null;
}

/**
 * Check if the capability has a package.json with dependencies.
 */
async function hasNodeModules(dir: string): Promise<boolean> {
	const pkgPath = join(dir, "package.json");
	const nodeModulesPath = join(dir, "node_modules");

	if (!existsSync(pkgPath)) {
		return true; // No package.json, no dependencies needed
	}

	try {
		const pkgContent = await readFile(pkgPath, "utf-8");
		const pkg = JSON.parse(pkgContent);
		const hasDeps =
			(pkg.dependencies && Object.keys(pkg.dependencies).length > 0) ||
			(pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0);

		if (!hasDeps) {
			return true; // No dependencies defined
		}

		return existsSync(nodeModulesPath);
	} catch {
		return true;
	}
}

/**
 * Run esbuild to compile the capability.
 */
async function runEsbuild(
	entryPoint: string,
	outputDir: string,
	watchMode: boolean,
): Promise<void> {
	const args = [
		entryPoint,
		"--bundle",
		"--platform=node",
		"--format=esm",
		"--target=node18",
		`--outfile=${join(outputDir, "index.js")}`,
		"--external:@omnidev-ai/*",
		"--external:node:*",
	];

	if (watchMode) {
		args.push("--watch");
	}

	return new Promise((resolvePromise, reject) => {
		// Try to use local esbuild first, fall back to npx
		const esbuildPaths = [join(process.cwd(), "node_modules", ".bin", "esbuild"), "esbuild"];

		let esbuildPath = "esbuild";
		for (const path of esbuildPaths) {
			if (existsSync(path)) {
				esbuildPath = path;
				break;
			}
		}

		// If esbuild not found locally, use npx
		const useNpx = !existsSync(esbuildPath);
		const command = useNpx ? "npx" : esbuildPath;
		const finalArgs = useNpx ? ["esbuild", ...args] : args;

		const proc = spawn(command, finalArgs, {
			stdio: "inherit",
			cwd: process.cwd(),
		});

		proc.on("error", (err) => {
			if (useNpx) {
				reject(new Error(`Failed to run esbuild via npx: ${err.message}`));
			} else {
				reject(new Error(`Failed to run esbuild: ${err.message}`));
			}
		});

		proc.on("close", (code) => {
			if (watchMode) {
				// In watch mode, the process keeps running
				// Only resolve when closed (e.g., Ctrl+C)
				resolvePromise();
			} else if (code === 0) {
				resolvePromise();
			} else {
				reject(new Error(`esbuild exited with code ${code}`));
			}
		});
	});
}

/**
 * Run the capability build command.
 */
export async function runBuild(options: BuildCommandOptions): Promise<void> {
	const cwd = process.cwd();

	// Check for capability.toml
	const capabilityTomlPath = join(cwd, "capability.toml");
	if (!existsSync(capabilityTomlPath)) {
		console.error("Error: No capability.toml found in current directory.");
		console.log("");
		console.log("  Make sure you're in a capability directory.");
		console.log("  Run: cd <capability-directory>");
		process.exit(1);
	}

	// Find entry point
	const entryPoint = findEntryPoint(cwd);
	if (!entryPoint) {
		console.error("Error: No entry point found (index.ts or index.js).");
		console.log("");
		console.log("  Create an index.ts file in your capability directory.");
		process.exit(1);
	}

	// Check for node_modules if there's a package.json
	const hasModules = await hasNodeModules(cwd);
	if (!hasModules) {
		console.error("Error: Dependencies not installed.");
		console.log("");
		console.log("  Run: npm install");
		process.exit(1);
	}

	// Create output directory
	const outputDir = join(cwd, "dist");
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	if (options.watch) {
		console.log("Building capability in watch mode...");
		console.log(`  Entry: ${entryPoint}`);
		console.log(`  Output: ${join(outputDir, "index.js")}`);
		console.log("");
		console.log("Press Ctrl+C to stop watching.");
		console.log("");
	} else {
		console.log("Building capability...");
	}

	try {
		await runEsbuild(entryPoint, outputDir, options.watch ?? false);

		if (!options.watch) {
			console.log("Build complete!");
			console.log(`  Output: ${join(outputDir, "index.js")}`);
		}
	} catch (error) {
		console.error("Build failed:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
