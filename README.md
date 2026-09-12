# College Athletics Consulting — Volleyball Analytics

Migration build **v0.3.2** replaces the abandoned Sites/Next runtime with a clean **Vite + React + TypeScript** frontend, **Supabase** for Postgres/Auth/Storage, and **Netlify Functions** for privileged ingestion and analytics access.

## Local / StackBlitz frontend

```bash
npm install
npm run verify
npm run dev
```

Without Supabase browser environment variables, the app intentionally renders a backend-setup screen instead of crashing.

## Environment variables

Browser-safe:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Netlify Functions only:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_EVIDENCE_BUCKET=volleyball-evidence`

Never commit real secrets.

## Supabase
Run `supabase/migrations/202609090001_initial.sql` in the Supabase SQL editor. It creates the canonical volleyball schema and the `volleyball-evidence` storage bucket.

## Architecture boundary
Deterministic TypeScript calculates statistics. Coach's Edge reads stored deterministic results and may explain them; it does not invent or calculate statistics itself.

## StackBlitz API development

`npm run dev` uses the official Netlify Vite plugin to emulate Netlify Functions inside the Vite dev server. Calls to `/.netlify/functions/*` therefore work in StackBlitz without running a second server.

### StackBlitz local API development

`npm run dev` uses a small Vite middleware bridge for `/.netlify/functions/*`, so StackBlitz can test the full app without running Netlify CLI or Netlify's local emulator. Production still deploys the same handlers as Netlify Functions.
