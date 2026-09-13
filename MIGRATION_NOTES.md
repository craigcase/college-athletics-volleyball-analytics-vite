
## v0.6.6 Program identity settings

Apply `supabase/migrations/202609130001_program_identity_settings.sql` after the v0.6.0 RLS migration. It adds nullable `programs.school_name` for existing programs and adds a seven-argument authenticated `create_volleyball_program` overload for new programs. Existing program data is preserved; owners can populate the full university name from Program Settings.

# Migration Notes — v0.6.1

## v0.6.3 public-source Edge fetch relay

StackBlitz URL imports now use one authenticated Supabase Edge Function (`fetch-public-source`) when the WebContainer cannot act as a normal internet-facing server. The relay only retrieves validated public HTTP(S) evidence and returns the bytes to the existing parser/persistence pipeline; roster, schedule, match reconciliation, analytics, and database writes remain in the normal application code. This is a one-time Supabase deployment and does not change the regular GitHub → refresh StackBlitz → guided-test workflow. See `SUPABASE_EDGE_FUNCTION_SETUP.md`.

v0.6.1 fixes the StackBlitz request-scope regression discovered after the v0.6.0 RLS migration.

The local API wrapper and every database repository now import the same request-scoped Supabase client module using canonical `.js` ESM specifiers. This keeps the signed-in user's `AsyncLocalStorage` database scope intact from the HTTP request wrapper through repository calls.

The StackBlitz runtime is now explicitly `user-scoped-only`. It deletes any inherited `SUPABASE_SECRET_KEY` before serving requests and `db/client.ts` refuses privileged fallback in this mode. A stale secret in StackBlitz can therefore no longer mask a lost request scope or trigger Supabase's "Forbidden use of secret API key in browser" error.

No new SQL is required. Keep the v0.6.0 `202609120001_user_scoped_rls.sql` migration already applied.

## v0.6.2 StackBlitz request scope

StackBlitz local API requests no longer rely on Node AsyncLocalStorage. WebContainer requests are serialized and hold one explicit user-scoped Supabase client for the full request, including across browser-hosted network awaits. Local development remains secret-key-disabled. No new Supabase migration is required for v0.6.2.

## v0.6.4 authenticated import token fix

- Preserves the verified bearer token alongside the authenticated user so program-scoped imports can pass the same access token to the public-source fetch relay.
- Fixes the `token is not defined` failure affecting schedule, matches, and import endpoints in v0.6.3.

