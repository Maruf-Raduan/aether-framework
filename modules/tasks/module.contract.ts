// modules/tasks/module.contract.ts
import { defineContract } from 'aether';

export default defineContract({
  name: 'tasks',
  description: 'Manages task CRUD, assignment, and status transitions for teams.',

  dependencies: { modules: ['auth'] },

  exposes: {
    routes: [
      { method: 'GET',    path: '/tasks',      auth: true },
      { method: 'POST',   path: '/tasks',      auth: true },
      { method: 'DELETE', path: '/tasks/:id',  auth: true, role: 'admin' },
    ],
    functions: ['createTask', 'updateTaskStatus', 'assignTask'],
    types: ['Task', 'TaskStatus', 'CreateTaskInput'],
  },

  sideEffects: [
    'writes to: tasks table',
    'emits event: task.created, task.assigned',
  ],

  invariants: [
    'A task must always belong to exactly one team',
    'Only team members can be assigned to a task',
    'Deleted tasks are soft-deleted, never hard-deleted',
  ],
});
