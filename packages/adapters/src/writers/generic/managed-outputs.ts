import { createHash } from "node:crypto";
import type { ManagedOutput, ManagedOutputCleanupStrategy } from "@omnidev-ai/core";

function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function trimTrailingSlash(path: string): string {
	return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function createManagedOutput(
	path: string,
	writerId: string,
	content: string,
	options?: {
		cleanupStrategy?: ManagedOutputCleanupStrategy;
		pruneRoot?: string;
		jsonKey?: string;
	},
): ManagedOutput {
	return {
		path,
		writerId,
		hash: hashContent(content),
		cleanupStrategy: options?.cleanupStrategy ?? "delete-file",
		...(options?.pruneRoot ? { pruneRoot: trimTrailingSlash(options.pruneRoot) } : {}),
		...(options?.jsonKey ? { jsonKey: options.jsonKey } : {}),
	};
}
