// lib/db.ts
// Central database access layer.
// All SQL queries must go through this module.
// Never import pg, postgres, or any DB driver directly in other files.

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a parameterised SQL query.
 * @param sql  - The SQL statement with $1, $2 placeholders
 * @param params - Ordered parameter values
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  // Stub implementation — replace with real pg Pool in production
  throw new Error('db.query() is not implemented in the scaffolding stub');
}

/**
 * Execute a set of operations inside a database transaction.
 * On error, the transaction is automatically rolled back.
 */
export async function transaction<T>(
  fn: (tx: { query: typeof query }) => Promise<T>,
): Promise<T> {
  // Stub implementation
  throw new Error('db.transaction() is not implemented in the scaffolding stub');
}

export const db = { query, transaction };
