/**
 * Version check utility - checks if a newer version is available on NPM
 * Silently fails if anything goes wrong to avoid disrupting CLI experience
 */

const NPM_REGISTRY_URL = "https://registry.npmjs.org/@omnidev-ai/cli/latest";
const FETCH_TIMEOUT_MS = 3000;

/**
 * Fetches the latest version from NPM registry
 * Returns null if the fetch fails for any reason
 */
async function fetchLatestVersion(): Promise<string | null> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		const response = await fetch(NPM_REGISTRY_URL, {
			signal: controller.signal,
			headers: {
				Accept: "application/json",
			},
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as { version?: string };
		return data.version ?? null;
	} catch {
		// Silently fail - network issues, timeouts, parse errors, etc.
		return null;
	}
}

/**
 * Compares two semver version strings
 * Returns true if latestVersion is greater than currentVersion
 */
function isNewerVersion(currentVersion: string, latestVersion: string): boolean {
	const current = currentVersion.split(".").map(Number);
	const latest = latestVersion.split(".").map(Number);

	for (let i = 0; i < Math.max(current.length, latest.length); i++) {
		const c = current[i] ?? 0;
		const l = latest[i] ?? 0;
		if (l > c) return true;
		if (l < c) return false;
	}
	return false;
}

/**
 * Checks for a newer version and prints a warning if one is available
 * This function is designed to be fire-and-forget - it will never throw
 * and will silently do nothing if any error occurs
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
	try {
		const latestVersion = await fetchLatestVersion();

		if (!latestVersion) {
			return;
		}

		if (isNewerVersion(currentVersion, latestVersion)) {
			console.log("");
			console.log(
				`\x1b[33m⚠️  A new version of OmniDev is available: ${latestVersion} (current: ${currentVersion})\x1b[0m`,
			);
			console.log(`   Run \x1b[36mnpm update -g @omnidev-ai/cli\x1b[0m to update`);
			console.log("");
		}
	} catch {
		// Silently fail - never disrupt CLI experience
	}
}
