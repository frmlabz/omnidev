import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node20",
	clean: true,
	// Bundle adapters inline, keep everything else external
	external: [
		"@omnidev-ai/core",
		"@inquirer/prompts",
		"@stricli/core",
		// Node built-ins
		/^node:/,
	],
	// Add node shebang to the CLI entry via rolldown output options
	outputOptions: {
		banner: "#!/usr/bin/env node",
	},
});
