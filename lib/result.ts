// lib/result.ts
// Result<T, E> type for error handling without exceptions.
// Use this instead of try/catch for all business logic errors.

export type Result<T, E = string> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

/** Construct a successful Result */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Construct a failed Result */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
