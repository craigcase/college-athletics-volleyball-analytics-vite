# Migration notes

The Sites/Next implementation is archived. This build intentionally does not carry forward framework middleware, server components, D1/R2 bindings, or ChatGPT Sites authentication headers.

Portable domain modules remain under `lib/` and `db/repositories/`. The browser app lives under `src/`; privileged HTTP operations live under `netlify/functions/`.


### v0.3.6 local development boundary

StackBlitz no longer executes server handlers through Vite's SSR module loader. A dedicated Node API process runs the same handler modules locally, and Vite proxies `/api/*` to it. This isolates local testing from Netlify while preserving Netlify Functions for deployment.

### v0.3.8 awaited StackBlitz API dispatch

v0.3.8 changed the single-port server to await `handleApi(...)` instead of dispatching it fire-and-forget. Runtime testing showed that this did **not** resolve the WebContainer socket hang-up; the embedded-Vite runtime was subsequently removed in v0.3.9.

### v0.3.7 single-port StackBlitz development

Local development now uses one Node HTTP server on port 5173. The server handles `/api/*` directly with the existing production handler modules and delegates all other traffic to Vite middleware. The separate port-8787 API process and Vite proxy are removed. Netlify remains production-only.

### v0.3.9 static single-port StackBlitz runtime

After repeated WebContainer failures at the Vite/server boundary, local development no longer embeds Vite at runtime. `npm run dev` builds the React client into `dist/` and then starts one plain Node HTTP server on port 5173. `/api/*` is dispatched directly to the existing production handler modules; frontend assets and SPA routes are served from `dist/`. The API adapter is based on the standalone v0.3.6 server path that already returned the expected unauthenticated response. Netlify production behavior is unchanged.


### v0.4.0 Supabase authentication boundary

Incoming browser session JWTs are no longer validated through the secret/admin Supabase client. The API now verifies the JWT directly with Supabase Auth using the publishable API key and `Authorization: Bearer <user JWT>`. The secret-key client remains reserved for privileged database and storage work. This matches the new publishable/secret key split while preserving the existing canonical repositories and API handlers.
