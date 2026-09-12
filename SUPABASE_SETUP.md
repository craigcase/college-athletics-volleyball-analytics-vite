# Supabase setup — v0.6.1

## Existing project

1. Keep the existing Supabase project and existing `202609090001_initial.sql` schema.
2. Open Supabase **SQL Editor**.
3. Create a new query and paste the full contents of `supabase/migrations/202609120001_user_scoped_rls.sql`.
4. Run it once. The migration is idempotent and can be re-run if necessary.
5. In StackBlitz `.env`, keep only the browser-safe development values:

```text
VITE_SUPABASE_URL=<your project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

`SUPABASE_SECRET_KEY` is not used by the StackBlitz development path. v0.6.1 also strips it from the local runtime process and blocks privileged fallback, so the local app cannot use it even if an older `.env` still contains it. You can remove the stale secret from StackBlitz when convenient.

## What the new migration does

- Keeps RLS enabled on all canonical/evidence/analytics tables.
- Grants authenticated users access only to programs where they have an active membership.
- Adds helper functions in a private schema for program/team/player/match scope.
- Adds an authenticated `create_volleyball_program(...)` RPC to create the initial team, program, season, owner membership, and activity row atomically.
- Adds private Storage policies for `volleyball-evidence` paths under `programs/<program_id>/...`.

## Normal workflow after this migration

1. Push a code build to GitHub.
2. Refresh StackBlitz.
3. Run `npm run verify`.
4. Run `npm run dev`.
5. Test the app in StackBlitz.

Netlify is not required for the ordinary development/test loop.


## v0.6.1 note

There is no new database migration for v0.6.1. If `202609120001_user_scoped_rls.sql` has already been run successfully, do not create or run another SQL query for this code fix.

## v0.6.2 StackBlitz request scope

StackBlitz local API requests no longer rely on Node AsyncLocalStorage. WebContainer requests are serialized and hold one explicit user-scoped Supabase client for the full request, including across browser-hosted network awaits. Local development remains secret-key-disabled. No new Supabase migration is required for v0.6.2.
