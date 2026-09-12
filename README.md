# College Athletics Consulting — Volleyball Analytics

Current migration build **v0.3.7** uses a clean **Vite + React + TypeScript** frontend, **Supabase** for Postgres/Auth/Storage, and **Netlify Functions** for privileged production HTTP operations.

## StackBlitz / local development

```bash
npm install
npm run verify
npm run dev
```

`npm run dev` starts one local development server on port **5173**. That server handles `/api/*` with the same handler modules used by Netlify in production and serves the Vite/React app for every other request. There is no Netlify CLI, Netlify Vite plugin, second API port, or Vite proxy in local development.

A quick local API check is:

```bash
curl -i --max-time 5 http://127.0.0.1:5173/api/program
```

Without an auth token, the expected response is a quick `401` with `{"error":"UNAUTHENTICATED"}`.

Without Supabase browser environment variables, the app intentionally renders a backend-setup screen instead of crashing.

## Environment variables

Browser-safe:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-side:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_EVIDENCE_BUCKET=volleyball-evidence`

Keep the server-side values in StackBlitz's encrypted environment for local development and in Netlify environment variables for production. Never commit real secrets.

## Supabase

Run `supabase/migrations/202609090001_initial.sql` in the Supabase SQL editor. It creates the canonical volleyball schema and the `volleyball-evidence` storage bucket.

## Production deployment

Netlify remains the production deployment target. Browser calls use `/api/*`; `netlify.toml` redirects those requests to `/.netlify/functions/*` before the SPA fallback.

## Architecture boundary

Deterministic TypeScript calculates statistics. Coach's Edge reads stored deterministic results and may explain them; it does not invent or calculate statistics itself.
