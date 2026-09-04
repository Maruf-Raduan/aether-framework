// modules/tasks/routes/create.ts
// POST /tasks — Create a new task for the authenticated user's team.
// Generated route — conforms to tasks module.contract.ts

import { requireUser } from '/lib/auth.js';
import { db } from '/lib/db.js';
import { ok, err } from '/lib/result.js';
import type { Result } from '/lib/result.js';
import type { Task, CreateTaskInput } from '../lib/types.js';

export async function handler(req: Request): Promise<Response> {
  // C3: requireUser() must be the first statement on all auth:true routes
  const user = await requireUser(req);

  const body = await req.json() as CreateTaskInput;

  const result: Result<Task, string> = await createTaskInDb(user.id, body);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result.value, { status: 201 });
}

async function createTaskInDb(
  userId: string,
  input: CreateTaskInput,
): Promise<Result<Task, string>> {
  // G1: DB access only via /lib/db.ts — never import pg directly
  const rows = await db.query(
    `INSERT INTO tasks (title, team_id, created_by, status)
     VALUES ($1, $2, $3, 'todo')
     RETURNING *`,
    [input.title, input.teamId, userId],
  );

  if (rows.length === 0) {
    return err('Failed to insert task');
  }

  return ok(rows[0] as unknown as Task);
}
