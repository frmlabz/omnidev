#!/usr/bin/env bun
/**
 * @omnidev/cli - Command-line interface for OmniDev
 *
 * This package provides the CLI for managing OmniDev configuration,
 * capabilities, and the MCP server.
 */

import { getVersion } from "@omnidev/core";

console.log(`OmniDev CLI v${getVersion()}`);
