/**
 * Tasks Capability
 *
 * Task management capability for OmniDev.
 * Provides CLI commands and sandbox-accessible functions for managing tasks.
 */

import type { CapabilityExport } from "@omnidev/core";
import { taskRoutes } from "./cli.js";
import { sync } from "./sync.js";

// Export types for TypeScript consumers
export type {
	Task,
	TaskStatus,
	Comment,
	CommentAuthor,
	CreateTaskInput,
	UpdateTaskInput,
	TaskFilter,
} from "./types.js";

// Export sandbox functions (accessible via omni_execute)
export {
	createTask,
	getTasks,
	getTask,
	updateTask,
	deleteTask,
	addComment,
	updateTaskStatus,
} from "./operations.js";

// Default export: CapabilityExport
export default {
	cliCommands: {
		task: taskRoutes,
	},

	gitignore: ["tasks/"],

	sync,
} satisfies CapabilityExport;
