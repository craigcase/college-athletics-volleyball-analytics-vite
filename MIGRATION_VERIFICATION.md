# Migration verification — v0.3.9

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

## v0.3.5 StackBlitz API path isolation

- Local development now uses `/api/*` instead of the Netlify-reserved `/.netlify/functions/*` path.
- Vite middleware serves `/api/*` directly in StackBlitz.
- Netlify production redirects `/api/*` to the corresponding Netlify Function before the SPA fallback.
- `scripts/**/*.ts` is included in the node TypeScript build project so the local bridge is verified by `tsc -b`.


## v0.3.6 StackBlitz local API server

- Replaced the Vite `ssrLoadModule()` middleware bridge with a dedicated local API server on port 8787.
- `npm run dev` starts both the API server and Vite together via `concurrently`.
- Vite proxies `/api/*` to `http://127.0.0.1:8787`; browser code remains same-origin.
- The local API server imports the existing Netlify handlers directly, so local and production request logic stay aligned.
- Production remains unchanged: Netlify redirects `/api/*` to deployed Netlify Functions.
- Acceptance check: `curl -i http://localhost:5173/api/program` should return quickly (typically `401` without an auth token), never hang or return Vite's SPA 404.

## v0.3.8 async API dispatch regression

The local HTTP server request callback is asynchronous and explicitly awaits `handleApi(req, res, pathname)`. Core migration coverage rejects the old fire-and-forget `void handleApi(...)` dispatch so StackBlitz API requests stay attached until a response is written.

## v0.3.7 single-port local development

- Replaced the two-process Vite + port-8787 API arrangement with one local development server on port 5173.
- `/api/*` is handled directly by the existing server handler modules; all non-API traffic is delegated to Vite middleware.
- Removed the Vite proxy, `concurrently`, `dev:api`, `dev:web`, and `scripts/local-api-server.ts`.
- Netlify production routing remains unchanged.
- Acceptance check: `curl -i --max-time 5 http://127.0.0.1:5173/api/program` returns promptly, normally `401` without an auth token.

## v0.3.9 static local runtime

- Vite is build-only during StackBlitz local development.
- `npm run dev` runs `vite build` and then one Node HTTP server on port 5173.
- The local runtime contains no Vite middleware mode, proxy, SSR module loading, or second API port.
- `/api/*` invokes the same handler modules used by Netlify production.
- Non-API traffic is served from `dist/` with React SPA fallback to `dist/index.html`.
- Regression coverage rejects the previous embedded-Vite runtime patterns.
- Acceptance check: `curl -i --max-time 5 http://127.0.0.1:5173/api/program` must return promptly, normally `401` with `{"error":"UNAUTHENTICATED"}` when no auth token is supplied.
