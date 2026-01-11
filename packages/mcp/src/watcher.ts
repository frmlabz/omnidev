/**
 * File watcher for hot reload functionality
 *
 * Watches config files and capability directories for changes
 */

import { existsSync, watch } from "node:fs";

const WATCH_PATHS = [".omni/config.toml", ".omni/config.local.toml", ".omni/capabilities/"];

/**
 * Start watching files for changes and trigger reload callback
 */
export function startWatcher(onReload: () => Promise<void>): void {
	let debounceTimer: Timer | null = null;

	const handleChange = () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(async () => {
			await onReload();
		}, 500);
	};

	for (const path of WATCH_PATHS) {
		try {
			// Only watch if path exists
			if (existsSync(path)) {
				watch(path, { recursive: true }, (_event, filename) => {
					console.error(`[omnidev] Change detected: ${filename ?? path}`);
					handleChange();
				});
			}
		} catch {
			// Path may not exist yet or not accessible
			console.error(`[omnidev] Warning: Cannot watch ${path}`);
		}
	}
}
