# Migration verification — v0.3.0

- Clean runtime: Vite + React + TypeScript.
- No Next.js, Sites, Cloudflare Workers, D1, R2, Wrangler, Vinext, or Sites auth runtime.
- Supabase Postgres schema and evidence bucket migration retained.
- Netlify Functions replace the six prior Next API routes and add read endpoints for roster, schedule, matches, and match summary.
- Browser auth uses Supabase access tokens; server functions verify the token before program-scoped privileged access.
- Existing deterministic analytics, reconciliation, parsers, evidence provenance, sticky overrides, and regression fixtures retained.
