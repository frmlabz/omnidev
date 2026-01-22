import { defineConfig } from "bunup";

export default defineConfig({
	entry: ["src/index.ts", "src/cli/index.ts"],
	format: ["esm"],
	target: "node",
	clean: true,
	// Keep dependencies external - users install them
	external: ["smol-toml", /^node:/],
	// Generate declaration files for TypeScript users
	dts: true,
	// Add node shebang for CLI entry (for npx @omnidev-ai/capability)
	banner: "#!/usr/bin/env node",
});
