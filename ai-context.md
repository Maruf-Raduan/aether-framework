# AI Context: my-app

## What this app does

Task management SaaS. Teams create projects, assign tasks, track progress. The application is
designed for small remote teams who need a lightweight, fast task management tool with no bloat.
Users belong to teams, and tasks always belong to exactly one team. Assignments are team-scoped.

## Architecture decisions (and WHY)

- **Server-first rendering**: SEO and initial load speed matter for our users. Avoid client
  components unless user interaction strictly requires it. The server renders the full page;
  client JavaScript is for progressive enhancement only.

- **Result type for errors**: Do NOT throw exceptions for business logic errors. Use `Result<T,E>`
  from `/lib/result.ts` instead. This applies to all service-layer functions. Exceptions are only
  for unrecoverable system errors (e.g. DB connection failure).

- **No ORM**: Raw SQL via `/lib/db.ts`. Never import `pg` directly in route files or lib utilities
  other than `/lib/db.ts`. The abstraction layer exists to centralise query observability and
  connection pooling.

- **Auth is always explicit**: Every authenticated route must call `requireUser(req)` as its
  first statement. There is no middleware magic — auth is opt-in and must be visible at the call
  site. This is intentional to prevent AI from silently skipping auth on generated routes.

- **Module boundaries are strict**: Never import from `/modules/*/` internal files. Import only
  from the module's public API (declared in its `exposes` contract). Use path aliases for all
  cross-module imports to make violations visible at lint time.

## Key files AI should know about

- `/lib/db.ts`      — all database access. Exposes `query()`, `transaction()`. Never import `pg` elsewhere.
- `/lib/auth.ts`    — `requireUser(req)`, `getSession(req)`. Always call `requireUser` first in auth routes.
- `/lib/result.ts`  — `Result<T,E>` type, `ok()`, `err()` constructors. Use instead of throw/catch.
- `/lib/validate.ts` — Zod-based request validation helpers. Use `parseBody()`, `parseQuery()`.

## Things AI commonly gets wrong here

- Do NOT use `try/catch` for business errors. Use `Result<T,E>` from `/lib/result.ts`. Exceptions
  are for system-level panics only.

- Do NOT import directly from `/modules/*` internals. Only import from the module's declared
  public API. Reaching into `modules/tasks/lib/queries.ts` directly bypasses the contract boundary.

- Do NOT write raw SQL outside `/lib/db.ts`. No inline `new Pool()`, no `pg` imports anywhere
  except `/lib/db.ts`. All queries go through `query()` or `transaction()`.

- Do NOT skip `requireUser()` on authenticated routes. It must be the first awaited call in every
  handler marked `auth: true` in the contract. There is no fallback middleware.

- Do NOT use `any` as an escape hatch. If you don't know the type, check the contract's `types`
  field or the shared types in `/lib/types.ts`.

- Route handlers must return a typed `Response` — do not use framework-specific magic response
  helpers that aren't declared in the contract.
