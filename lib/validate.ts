// lib/validate.ts
// Zod-based request validation helpers.

export async function parseBody<T>(req: Request, schema: unknown): Promise<T> {
  // Stub — implement with Zod in production
  return req.json() as Promise<T>;
}

export async function parseQuery<T>(req: Request, schema: unknown): Promise<T> {
  // Stub
  const url = new URL(req.url);
  return Object.fromEntries(url.searchParams) as T;
}
