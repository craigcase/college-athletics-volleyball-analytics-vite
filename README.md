# College Athletics Consulting — Volleyball Analytics

## v0.6.3 public-source Edge fetch relay

StackBlitz URL imports now use one authenticated Supabase Edge Function (`fetch-public-source`) when the WebContainer cannot act as a normal internet-facing server. The relay only retrieves validated public HTTP(S) evidence and returns the bytes to the existing parser/persistence pipeline; roster, schedule, match reconciliation, analytics, and database writes remain in the normal application code. This is a one-time Supabase deployment and does not change the regular GitHub → refresh StackBlitz → guided-test workflow. See `SUPABASE_EDGE_FUNCTION_SETUP.md`.

Current migration build **v0.6.1** restores the fast development loop: **GitHub → StackBlitz → guided testing**. StackBlitz runs the React app and the local API on one port, but database/storage access is scoped to the signed-in Supabase user through Row Level Security. No Supabase secret key is required for local development.

## StackBlitz development

```bash
npm install
npm run verify
npm run dev
```

`npm run dev` builds the Vite client into `dist/`, then starts one local server on port **5173**. `/api/*` uses the same application handlers as production, but each authenticated local request creates a Supabase client with the project publishable key plus that user's JWT. All authorization is enforced by Postgres/Storage RLS.

Local `.env` needs only:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Do not put `SUPABASE_SECRET_KEY` in StackBlitz. v0.6.1 also hard-disables the privileged secret-key fallback in the local runtime, so an old secret left in `.env` cannot be used accidentally.

## One-time Supabase update (introduced in v0.6.0)

The existing database was created with fail-closed RLS and no browser/user policies. Run these migrations in order in Supabase SQL Editor:

1. `supabase/migrations/202609090001_initial.sql` — already applied on existing projects.
2. `supabase/migrations/202609120001_user_scoped_rls.sql` — introduced in v0.6.0 and still required.

The second migration adds user-scoped RLS, Storage policies, and the authenticated `create_volleyball_program` RPC used to bootstrap a coach's first program safely.

## Architecture

- Vite + React + TypeScript frontend
- Supabase Auth + Postgres + Storage
- Deterministic TypeScript analytics
- One local StackBlitz server for guided testing
- Netlify remains an optional production hosting/serverless target, not part of the ordinary development loop

Coach's Edge reads stored deterministic analytics. It does not invent or calculate statistics with an LLM.


## v0.6.1 request-scope fix

v0.6.1 normalizes every import of the request-scoped Supabase database client to the same ESM module path (`db/client.js`). This prevents StackBlitz/tsx from creating separate module instances where the API wrapper sets an `AsyncLocalStorage` scope in one instance but a repository reads from another. Local development also forces `SUPABASE_DB_ACCESS_MODE=user-scoped-only` and removes `SUPABASE_SECRET_KEY` from the running process before requests are handled.

There is **no new Supabase SQL migration** for v0.6.1. If `202609120001_user_scoped_rls.sql` already returned `Success. No rows returned`, move directly to code verification and Program Setup testing.

## v0.6.2 StackBlitz request scope

StackBlitz local API requests no longer rely on Node AsyncLocalStorage. WebContainer requests are serialized and hold one explicit user-scoped Supabase client for the full request, including across browser-hosted network awaits. Local development remains secret-key-disabled. No new Supabase migration is required for v0.6.2.
