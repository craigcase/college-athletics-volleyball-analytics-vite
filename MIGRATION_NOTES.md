# Migration notes

The Sites/Next implementation is archived. This build intentionally does not carry forward framework middleware, server components, D1/R2 bindings, or ChatGPT Sites authentication headers.

Portable domain modules remain under `lib/` and `db/repositories/`. The browser app lives under `src/`; privileged HTTP operations live under `netlify/functions/`.


### v0.3.6 local development boundary

StackBlitz no longer executes server handlers through Vite's SSR module loader. A dedicated Node API process runs the same handler modules locally, and Vite proxies `/api/*` to it. This isolates local testing from Netlify while preserving Netlify Functions for deployment.

### v0.3.8 awaited StackBlitz API dispatch

StackBlitz WebContainers require the custom HTTP request callback to remain attached while asynchronous API handlers complete. The single-port local server now awaits `handleApi(...)` instead of dispatching it fire-and-forget. This preserves the v0.3.7 one-port architecture while preventing real `/api/*` requests from ending with a socket hang-up.

### v0.3.7 single-port StackBlitz development

Local development now uses one Node HTTP server on port 5173. The server handles `/api/*` directly with the existing production handler modules and delegates all other traffic to Vite middleware. The separate port-8787 API process and Vite proxy are removed. Netlify remains production-only.

### v0.3.9 static single-port StackBlitz runtime

After repeated WebContainer failures at the Vite/server boundary, local development no longer embeds Vite at runtime. `npm run dev` builds the React client into `dist/` and then starts one plain Node HTTP server on port 5173. `/api/*` is dispatched directly to the existing production handler modules; frontend assets and SPA routes are served from `dist/`. The API adapter is based on the standalone v0.3.6 server path that already returned the expected unauthenticated response. Netlify production behavior is unchanged.
