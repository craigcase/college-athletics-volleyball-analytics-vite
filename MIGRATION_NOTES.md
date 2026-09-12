# Migration Notes — v0.6.1

v0.6.1 fixes the StackBlitz request-scope regression discovered after the v0.6.0 RLS migration.

The local API wrapper and every database repository now import the same request-scoped Supabase client module using canonical `.js` ESM specifiers. This keeps the signed-in user's `AsyncLocalStorage` database scope intact from the HTTP request wrapper through repository calls.

The StackBlitz runtime is now explicitly `user-scoped-only`. It deletes any inherited `SUPABASE_SECRET_KEY` before serving requests and `db/client.ts` refuses privileged fallback in this mode. A stale secret in StackBlitz can therefore no longer mask a lost request scope or trigger Supabase's "Forbidden use of secret API key in browser" error.

No new SQL is required. Keep the v0.6.0 `202609120001_user_scoped_rls.sql` migration already applied.
