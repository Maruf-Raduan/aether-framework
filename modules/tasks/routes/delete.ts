import { requireUser } from '/lib/auth.js';
import { db } from '/lib/db.js';

export async function DELETE(req: Request) {
  const user = await requireUser(req);
  const taskId = "123" as { _brand: 'TaskId' } & string;
  deleteTask(taskId); 
  return new Response("OK");
}

function deleteTask(id: { _brand: 'TaskId' } & string) {}