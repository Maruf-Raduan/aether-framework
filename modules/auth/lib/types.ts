// modules/auth/lib/types.ts
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface AuthError {
  code: string;
  message: string;
}
