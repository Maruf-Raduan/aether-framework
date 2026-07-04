// modules/auth/lib/auth-service.ts
import { type User, type Session } from './types.js';

export async function requireUser(req: Request): Promise<User> {
  throw new Response('Unauthorized', { status: 401 });
}

export async function getSession(req: Request): Promise<Session | null> {
  return null;
}

export async function createSession(userId: string): Promise<Session> {
  return {} as Session;
}

export async function invalidateSession(sessionId: string): Promise<void> {
  // Stub
}
