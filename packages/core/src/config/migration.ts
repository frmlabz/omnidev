import { existsSync } from "node:fs";
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Check if old omni/ structure exists
 */
export function hasOldStructure(): boolean {
	return existsSync("omni") && existsSync("omni/config.toml");
}

/**
 * Check if new .omni/ structure exists
 */
export function hasNewStructure(): boolean {
	return existsSync(".omni") && existsSync(".omni/config.toml");
}

/**
 * Recursively copy directory contents
 */
function copyDirectory(source: string, dest: string): void {
	mkdirSync(dest, { recursive: true });

	const entries = readdirSync(source);
	for (const entry of entries) {
		const sourcePath = join(source, entry);
		const destPath = join(dest, entry);

		if (statSync(sourcePath).isDirectory()) {
			copyDirectory(sourcePath, destPath);
		} else {
			copyFileSync(sourcePath, destPath);
		}
	}
}

/**
 * Migrate from old omni/ structure to new .omni/ structure
 */
export async function migrateStructure(): Promise<void> {
	if (!hasOldStructure()) {
		throw new Error("No old omni/ structure found to migrate");
	}

	if (hasNewStructure()) {
		throw new Error("New .omni/ structure already exists. Cannot migrate.");
	}

	// Create .omni directory
	mkdirSync(".omni", { recursive: true });

	// Move config.toml
	if (existsSync("omni/config.toml")) {
		copyFileSync("omni/config.toml", ".omni/config.toml");
	}

	// Move capabilities directory if it exists
	if (existsSync("omni/capabilities")) {
		copyDirectory("omni/capabilities", ".omni/capabilities");
	}

	// Move any other files from omni/ to .omni/
	const entries = readdirSync("omni");
	for (const entry of entries) {
		if (entry === "config.toml" || entry === "capabilities") {
			// Already handled above
			continue;
		}

		const sourcePath = join("omni", entry);
		const destPath = join(".omni", entry);

		if (statSync(sourcePath).isDirectory()) {
			copyDirectory(sourcePath, destPath);
		} else {
			copyFileSync(sourcePath, destPath);
		}
	}

	// Delete old omni/ folder
	rmSync("omni", { recursive: true, force: true });
}

/**
 * Get summary of files that will be migrated
 */
export function getMigrationSummary(): string[] {
	const summary: string[] = [];

	if (existsSync("omni/config.toml")) {
		summary.push("• Move omni/config.toml → .omni/config.toml");
	}

	if (existsSync("omni/capabilities")) {
		summary.push("• Move omni/capabilities/ → .omni/capabilities/");
	}

	const entries = readdirSync("omni");
	const otherFiles = entries.filter((e) => e !== "config.toml" && e !== "capabilities");
	if (otherFiles.length > 0) {
		summary.push(`• Move ${otherFiles.length} other file(s)`);
	}

	summary.push(
		"• Create new config files (provider.toml, capabilities.toml, profiles.toml, .gitignore)",
	);
	summary.push("• Remove old omni/ folder");

	return summary;
}
