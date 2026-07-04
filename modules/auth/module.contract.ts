// modules/auth/module.contract.ts
import { defineContract } from 'aether';

export default defineContract({
  name: 'auth',
  description: 'Handles user authentication, session management, and authorization utilities.',

  dependencies: { modules: [] },

  exposes: {
    routes: [
      { method: 'POST', path: '/auth/login',   auth: false },
      { method: 'POST', path: '/auth/logout',  auth: true },
      { method: 'GET',  path: '/auth/session', auth: true },
    ],
    functions: ['requireUser', 'getSession', 'createSession', 'invalidateSession'],
    types: ['User', 'Session', 'AuthError'],
  },

  sideEffects: [
    'writes to: sessions table',
    'reads from: users table',
  ],

  invariants: [
    'A session must always be bound to exactly one user',
    'Expired sessions must never be returned as valid',
    'Logout must invalidate the session immediately',
  ],
});
