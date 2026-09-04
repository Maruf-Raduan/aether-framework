// lib/auth.ts
// Authentication and authorization utilities.
// Use requireUser() at the start of every auth:true route handler.

export interface User {
  id: string;
  email: string;
  teamIds: string[];
  role: 'admin' | 'member' | 'viewer';
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Validates the request's session and returns the authenticated user.
 * Must be called as the first statement in every auth:true route handler.
 * Throws a 401 Response if the session is missing or invalid.
 */
export async function requireUser(req: Request): Promise<User> {
  // Stub implementation
  throw new Response('Unauthorized', { status: 401 });
}

/**
 * Returns the session for the current request, or null if not authenticated.
 */
export async function getSession(req: Request): Promise<Session | null> {
  // Stub implementation
  return null;
}
