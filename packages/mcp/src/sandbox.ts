import { existsSync } from "node:fs";
import { mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LoadedCapability } from "@omnidev/core";
import { generateWrapperModule } from "./codegen/index.js";
import type { McpController } from "./controller/controller.js";

const SANDBOX_DIR = ".omni/sandbox";
const SANDBOX_NODE_MODULES = ".omni/sandbox/node_modules";

/**
 * Sets up the sandbox environment by creating symlinks to enabled capabilities.
 * This allows the sandbox to import capability modules by name.
 */
export async function setupSandbox(capabilities: LoadedCapability[]): Promise<void> {
	// Create sandbox directory
	await mkdir(SANDBOX_DIR, { recursive: true });
	await mkdir(SANDBOX_NODE_MODULES, { recursive: true });

	// Clean existing symlinks
	if (existsSync(SANDBOX_NODE_MODULES)) {
		const entries = await readdir(SANDBOX_NODE_MODULES);
		for (const entry of entries) {
			const entryPath = join(SANDBOX_NODE_MODULES, entry);
			await rm(entryPath, { recursive: true, force: true }).catch(() => {
				// Ignore errors
			});
		}
	}

	// Create symlinks for each capability (skip MCP capabilities - they get wrappers)
	for (const cap of capabilities) {
		// Skip MCP capabilities - they will be handled by setupMcpWrappers
		if (cap.config.mcp) {
			continue;
		}

		const moduleName = cap.config.exports?.module ?? cap.id;
		const linkPath = join(SANDBOX_NODE_MODULES, moduleName);
		const targetPath = join("../../..", cap.path);

		try {
			await symlink(targetPath, linkPath, "dir");
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code !== "EEXIST") {
				console.error(`Failed to symlink ${moduleName}:`, e);
			}
		}
	}
}

/**
 * Sets up wrapper modules for MCP capabilities.
 * This should be called AFTER the MCP controller has spawned child processes.
 */
export async function setupMcpWrappers(
	capabilities: LoadedCapability[],
	controller: McpController,
	relayPort: number,
): Promise<void> {
	const mcpCapabilities = capabilities.filter((c) => c.config.mcp);

	for (const cap of mcpCapabilities) {
		const moduleName = cap.config.exports?.module ?? cap.id;
		const moduleDir = join(SANDBOX_NODE_MODULES, moduleName);

		try {
			// Get the connection to check if it's connected
			const connection = controller.getConnection(cap.id);
			if (!connection || connection.process.status !== "connected") {
				console.error(`MCP ${cap.id} not connected, skipping wrapper generation`);
				continue;
			}

			// Get tools from the MCP
			const tools = await controller.listTools(cap.id);

			// Generate wrapper module
			const wrapperCode = generateWrapperModule(cap.id, tools, relayPort);

			// Create module directory and write wrapper
			await mkdir(moduleDir, { recursive: true });
			await writeFile(join(moduleDir, "index.ts"), wrapperCode);

			console.error(`Generated wrapper for ${cap.id} with ${tools.length} tools`);
		} catch (error) {
			console.error(
				`Failed to generate wrapper for ${cap.id}:`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}
}
