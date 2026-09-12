# Migration verification — v0.3.2

- Clean runtime: Vite + React + TypeScript.
- No Next.js, Sites, Cloudflare Workers, D1, R2, Wrangler, Vinext, or Sites auth runtime.
- Supabase Postgres schema and evidence bucket migration retained.
- Netlify Functions replace the six prior Next API routes and add read endpoints for roster, schedule, matches, and match summary.
- Browser auth uses Supabase access tokens; server functions verify the token before program-scoped privileged access.
- Existing deterministic analytics, reconciliation, parsers, evidence provenance, sticky overrides, and regression fixtures retained.

## v0.3.1 StackBlitz build configuration

- Added `noEmit: true` to `tsconfig.node.json` so `allowImportingTsExtensions` is valid during `tsc -b`.
- Added regression coverage for the Vite node TypeScript build configuration.


## v0.3.2 TypeScript target fix

- Added `target: ES2022` to `tsconfig.node.json` so Netlify Functions and shared server/domain modules can use `Set`, `Map`, `matchAll`, and other modern iterables during `tsc -b`.
- Added `*.tsbuildinfo` to `.gitignore` so TypeScript project-reference cache files do not appear as source changes.
- Added regression coverage for both settings.

## v0.3.3 StackBlitz Netlify Functions bridge

- Added the official `@netlify/vite-plugin` so plain `vite dev` emulates `/.netlify/functions/*` during StackBlitz development.
- Added regression coverage requiring the Netlify Vite plugin in both dependencies and `vite.config.ts`.
- This removes the HTTP 404 on Create Program caused by Vite serving only the frontend.

## v0.3.4 StackBlitz local API bridge

- Removed the Netlify Vite dev plugin from the StackBlitz development path.
- Added `scripts/vite-local-functions.ts`, a Vite-only middleware bridge that invokes the existing Netlify Function handlers at `/.netlify/functions/*` during local development.
- Production deployment is unchanged: Netlify still deploys the same `netlify/functions/*.ts` handlers from `netlify.toml`.
- Local server-only Supabase values are loaded from `.env` into the Vite server process; only `VITE_*` variables are exposed to browser code.
