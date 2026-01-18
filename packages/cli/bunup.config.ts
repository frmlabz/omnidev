import { defineConfig } from "bunup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node",
	clean: true,
	external: [
		"@inquirer/prompts",
		"@stricli/core",
		// Node built-ins
		/^node:/,
	],
	noExternal: ["@omnidev-ai/adapters", "@omnidev-ai/core"],
	// Add node shebang to the CLI entry
	banner: "#!/usr/bin/env node",
});
