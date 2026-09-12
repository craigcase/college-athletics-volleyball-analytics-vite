# College Athletics Consulting — Volleyball Analytics

Current migration build **v0.6.0** restores the fast development loop: **GitHub → StackBlitz → guided testing**. StackBlitz runs the React app and the local API on one port, but database/storage access is scoped to the signed-in Supabase user through Row Level Security. No Supabase secret key is required for local development.

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

Do not put `SUPABASE_SECRET_KEY` in StackBlitz.

## One-time Supabase update for v0.6.0

The existing database was created with fail-closed RLS and no browser/user policies. Run these migrations in order in Supabase SQL Editor:

1. `supabase/migrations/202609090001_initial.sql` — already applied on existing projects.
2. `supabase/migrations/202609120001_user_scoped_rls.sql` — new in v0.6.0.

The second migration adds user-scoped RLS, Storage policies, and the authenticated `create_volleyball_program` RPC used to bootstrap a coach's first program safely.

## Architecture

- Vite + React + TypeScript frontend
- Supabase Auth + Postgres + Storage
- Deterministic TypeScript analytics
- One local StackBlitz server for guided testing
- Netlify remains an optional production hosting/serverless target, not part of the ordinary development loop

Coach's Edge reads stored deterministic analytics. It does not invent or calculate statistics with an LLM.
