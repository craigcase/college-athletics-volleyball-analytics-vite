# Migration Verification — v0.6.1

## v0.6.3 public-source Edge fetch relay

StackBlitz URL imports now use one authenticated Supabase Edge Function (`fetch-public-source`) when the WebContainer cannot act as a normal internet-facing server. The relay only retrieves validated public HTTP(S) evidence and returns the bytes to the existing parser/persistence pipeline; roster, schedule, match reconciliation, analytics, and database writes remain in the normal application code. This is a one-time Supabase deployment and does not change the regular GitHub → refresh StackBlitz → guided-test workflow. See `SUPABASE_EDGE_FUNCTION_SETUP.md`.

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

## v0.6.4 authenticated import token fix

- Preserves the verified bearer token alongside the authenticated user so program-scoped imports can pass the same access token to the public-source fetch relay.
- Fixes the `token is not defined` failure affecting schedule, matches, and import endpoints in v0.6.3.

