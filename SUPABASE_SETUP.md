# Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/202609090001_initial.sql`.
3. In StackBlitz encrypted environment variables add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. In Netlify environment variables add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_EVIDENCE_BUCKET=volleyball-evidence`.
5. Enable email/password auth in Supabase Authentication.
6. Deploy through Netlify. Privileged roster/schedule/match imports run only through Netlify Functions using the server-only secret key.


### StackBlitz local server

Keep the server-only `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_EVIDENCE_BUCKET` values in StackBlitz's encrypted `.env`. The local API process loads `.env` with Node's built-in environment-file loader; only `VITE_*` values are exposed to browser code.

### v0.3.8 local development

`npm run dev` now runs the frontend and local API on the same port (5173). The local server loads `.env` when present and uses the server-only Supabase values for `/api/*`; Vite still exposes only `VITE_*` values to browser code.

### v0.3.9 StackBlitz runtime

`npm run dev` builds the browser client and then serves both the built app and `/api/*` from one plain Node server on port 5173. Vite is not running as a development server. The Node process loads server-only Supabase values from `.env` when present; browser-safe `VITE_*` values are embedded by the Vite build.


### v0.4.0 user-token verification

No new environment variable is required. The local and production API handlers verify each incoming Supabase user JWT against the Auth `/auth/v1/user` endpoint using `VITE_SUPABASE_PUBLISHABLE_KEY` as the `apikey`. `SUPABASE_SECRET_KEY` remains server-only and is used only by privileged database/storage clients.

The repository includes `.env.example` with placeholders only. Keep the real `.env` private in StackBlitz/host environment storage and out of Git.
