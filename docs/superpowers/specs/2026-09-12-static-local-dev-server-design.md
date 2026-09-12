# Static Local Development Server Design

**Date:** 2026-09-12

## Problem

The StackBlitz local runtime has repeatedly failed when Vite and the server-side API runtime are coupled through middleware, proxying, or SSR loading. The current single-port embedded-Vite server can answer simple local routes, but requests that dispatch into the real API handlers can terminate with `curl: socket hang up`. By contrast, the earlier standalone Node API server successfully returned the expected `401 UNAUTHENTICATED` response from the same `program` handler.

## Decision

Use Vite only as a build tool during local development. `npm run dev` will build the React client into `dist/` and then start one plain Node HTTP server on port 5173. That server owns all runtime traffic:

- `/api/*` dispatches directly to the existing Netlify-compatible handlers.
- Static asset requests are served from `dist/`.
- Non-file frontend routes fall back to `dist/index.html` for the React SPA.

Vite middleware mode, Vite proxying, SSR module loading, and a second local port are not used.

## Production Boundary

Production remains unchanged:

- Netlify builds the Vite client.
- Netlify serves `dist/`.
- Netlify redirects `/api/*` to deployed Netlify Functions.
- Supabase remains the database, authentication, and storage backend.

The local server is development-only infrastructure and must not alter production API behavior.

## Local Runtime Flow

```text
npm run dev
  -> vite build
  -> tsx scripts/local-dev-server.ts

Browser / curl -> http://localhost:5173
  /api/*        -> existing function handler -> Supabase
  /assets/*     -> dist/assets/*
  other files   -> dist/*
  SPA route     -> dist/index.html
```

## Requirements

- Exactly one local HTTP port: 5173 by default, overridable with `PORT`.
- No Vite dev server at runtime.
- No Vite middleware mode.
- No Vite proxy.
- No second API port.
- Reuse the existing API handlers without copies.
- Preserve same-origin `/api/*` calls from the browser.
- Serve correct MIME types for common Vite output files.
- Prevent path traversal outside `dist/`.
- Support `GET` and `HEAD` for static files.
- Return JSON 404s for unknown `/api/*` function names.
- Return SPA fallback for non-file frontend routes.
- Fail clearly if `dist/index.html` is missing.
- Keep Netlify production redirects unchanged.

## Verification

The build is acceptable when:

1. Static architecture regression tests reject Vite middleware/proxy/runtime imports in `scripts/local-dev-server.ts`.
2. `npm run verify` passes in StackBlitz.
3. `npm run dev` starts one server on port 5173 after building `dist/`.
4. `curl -i --max-time 5 http://127.0.0.1:5173/api/program` returns promptly with `401 UNAUTHENTICATED` when no token is supplied.
5. The StackBlitz preview loads the React application on port 5173.
6. Authenticated `Create Program` reaches the real handler and Supabase instead of returning a local routing error or socket hang-up.
