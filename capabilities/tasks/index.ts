/**
 * Tasks Capability
 *
 * Built-in capability for task management in OmniDev.
 * Provides tools for creating, tracking, and completing tasks.
 */

export interface Task {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  createdAt: string;
}

export const capabilityId = "tasks";
export const capabilityVersion = "0.1.0";
