import { buildApplication, buildRouteMap } from '@stricli/core';
import { doctorCommand } from './commands/doctor';
import { initCommand } from './commands/init';
import { capabilityRoutes } from './commands/capability';
import { profileRoutes } from './commands/profile';
import { agentsRoutes } from './commands/agents';

const app = buildApplication(
	buildRouteMap({
		routes: {
			init: initCommand,
			doctor: doctorCommand,
			capability: capabilityRoutes,
			profile: profileRoutes,
			agents: agentsRoutes,
		},
		docs: {
			brief: 'OmniDev commands',
		},
	}),
	{
		name: 'omnidev',
		versionInfo: {
			currentVersion: '0.1.0',
		},
	},
);

export { app };
