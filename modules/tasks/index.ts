// modules/tasks/index.ts
// Public API for the tasks module.
// Only names listed here are safe for cross-module consumption.
// Internal files (lib/, queries/, etc.) must never be imported directly.

export { createTask } from './lib/task-service.js';
export { updateTaskStatus } from './lib/task-service.js';
export { assignTask } from './lib/task-service.js';

export type { Task, TaskStatus, CreateTaskInput } from './lib/types.js';
