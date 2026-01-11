import { buildApplication, buildRouteMap } from "@stricli/core";
import { capabilityRoutes } from "./commands/capability";
import { doctorCommand } from "./commands/doctor";
import { initCommand } from "./commands/init";
import { mcpRoutes } from "./commands/mcp";
import { profileRoutes } from "./commands/profile";
import { serveCommand } from "./commands/serve";
import { syncCommand } from "./commands/sync";

const app = buildApplication(
	buildRouteMap({
		routes: {
			init: initCommand,
			doctor: doctorCommand,
			serve: serveCommand,
			sync: syncCommand,
			capability: capabilityRoutes,
			profile: profileRoutes,
			mcp: mcpRoutes,
		},
		docs: {
			brief: "OmniDev commands",
		},
	}),
	{
		name: "omnidev",
		versionInfo: {
			currentVersion: "0.1.0",
		},
	},
);

export { app };
