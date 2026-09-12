# Migration Verification — v0.6.0

## Local runtime

- One local server on port 5173.
- Vite builds the frontend; Node serves `dist/` and `/api/*`.
- Local API requests are wrapped in `runWithUserAccessToken(...)`.
- User-scoped Supabase clients use the publishable key plus the signed-in user's bearer token.
- The StackBlitz path does not require or read `SUPABASE_SECRET_KEY` for authenticated requests.

## Supabase

- Initial schema remains `202609090001_initial.sql`.
- New migration `202609120001_user_scoped_rls.sql` adds authenticated RLS policies, Storage policies, private membership helper functions, explicit Data API grants, and `create_volleyball_program(...)`.
- Program creation uses the RPC when running under a user-scoped request.
- Existing privileged server fallback remains available only outside the local user-scoped path for later production use.

## Verification commands

```bash
npm install
npm run verify
npm run dev
```

Unauthenticated smoke test:

```bash
curl -i --max-time 5 http://127.0.0.1:5173/api/program
```

Expected: `401 Unauthorized` with `{"error":"UNAUTHENTICATED"}`.

The real acceptance test is signing in through the Preview and completing **Create Program** after the new Supabase migration is applied.
