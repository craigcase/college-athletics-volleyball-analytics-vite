# Supabase setup — v0.6.0

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

`SUPABASE_SECRET_KEY` is not used by the StackBlitz development path and should be removed from StackBlitz after v0.6.0 is installed.

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
