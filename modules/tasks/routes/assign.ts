import { requireUser } from '/lib/auth.js';
import { db } from '/lib/db.js';
import { ok, err } from '/lib/result.js';

export async function POST(req: Request) {
  const user = await requireUser(req);
  return ok({ success: true });
}