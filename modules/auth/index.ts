// modules/auth/index.ts
// Public API for the auth module.

export { requireUser } from './lib/auth-service.js';
export { getSession } from './lib/auth-service.js';
export { createSession } from './lib/auth-service.js';
export { invalidateSession } from './lib/auth-service.js';

export type { User, Session, AuthError } from './lib/types.js';
