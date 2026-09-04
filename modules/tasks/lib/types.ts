// modules/tasks/lib/types.ts
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  teamId: string;
  createdBy: string;
  assignedTo?: string;
  status: TaskStatus;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  teamId: string;
}
