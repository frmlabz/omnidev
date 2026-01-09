import { buildApplication, buildRouteMap } from '@stricli/core';
import { doctorCommand } from './commands/doctor';
import { initCommand } from './commands/init';

const app = buildApplication(
	buildRouteMap({
		routes: {
			init: initCommand,
			doctor: doctorCommand,
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
