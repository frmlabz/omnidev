/**
 * Debug logging utility for capabilities.
 *
 * Only outputs when OMNIDEV_DEBUG environment variable is set.
 */

/**
 * Log debug messages when OMNIDEV_DEBUG is set.
 *
 * @example
 * ```typescript
 * import { debug } from "@omnidev-ai/capability";
 *
 * debug("Processing files", { count: 10, path: "/src" });
 * // Only outputs when OMNIDEV_DEBUG=1 or OMNIDEV_DEBUG=true
 * ```
 */
export function debug(message: string, context?: Record<string, unknown>): void {
	const debugEnabled = process.env["OMNIDEV_DEBUG"];
	if (!debugEnabled || debugEnabled === "0" || debugEnabled === "false") {
		return;
	}

	const timestamp = new Date().toISOString();
	const prefix = `[DEBUG ${timestamp}]`;

	if (context && Object.keys(context).length > 0) {
		console.log(prefix, message, context);
	} else {
		console.log(prefix, message);
	}
}
