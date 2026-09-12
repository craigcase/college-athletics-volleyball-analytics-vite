# Migration Verification — v0.6.1

## Request-scoped database client

- `scripts/local-dev-server.ts` imports `../db/client.js`.
- Every repository under `db/repositories/` imports `../client.js`.
- `lib/services/import-match.ts` imports `../../db/client.js`.
- Regression tests reject extensionless imports of the request-scoped client.

## Local security boundary

- Local development sets `SUPABASE_DB_ACCESS_MODE=user-scoped-only`.
- Local development removes `SUPABASE_SECRET_KEY` from `process.env` before serving requests.
- `getAdminClient()` refuses secret-key fallback while the local user-scoped mode is active.
- Authenticated API requests continue to use the publishable key plus the signed-in user's JWT under Supabase RLS.

## Supabase

- Initial schema remains `202609090001_initial.sql`.
- User-scoped migration remains `202609120001_user_scoped_rls.sql`.
- **No additional SQL migration is required for v0.6.1.**

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

The acceptance test is signing in through the Preview and completing **Create Program** without a secret-key browser error.

## v0.6.2 StackBlitz request scope

StackBlitz local API requests no longer rely on Node AsyncLocalStorage. WebContainer requests are serialized and hold one explicit user-scoped Supabase client for the full request, including across browser-hosted network awaits. Local development remains secret-key-disabled. No new Supabase migration is required for v0.6.2.
