#!/usr/bin/env bun
/**
 * @omnidev/cli - Command-line interface for OmniDev
 *
 * This package provides the CLI for managing OmniDev configuration,
 * capabilities, and the MCP server.
 */

import { run } from "@stricli/core";
import { app } from "./app";

run(app, process.argv.slice(2), {
	// biome-ignore lint/suspicious/noExplicitAny: Stricli expects a process-like object with stdin/stdout/stderr
	process: process as any,
});
