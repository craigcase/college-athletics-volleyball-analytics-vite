# Migration notes

The Sites/Next implementation is archived. This build intentionally does not carry forward framework middleware, server components, D1/R2 bindings, or ChatGPT Sites authentication headers.

Portable domain modules remain under `lib/` and `db/repositories/`. The browser app lives under `src/`; privileged HTTP operations live under `netlify/functions/`.


### v0.3.6 local development boundary

StackBlitz no longer executes server handlers through Vite's SSR module loader. A dedicated Node API process runs the same handler modules locally, and Vite proxies `/api/*` to it. This isolates local testing from Netlify while preserving Netlify Functions for deployment.

### v0.3.7 single-port StackBlitz development

Local development now uses one Node HTTP server on port 5173. The server handles `/api/*` directly with the existing production handler modules and delegates all other traffic to Vite middleware. The separate port-8787 API process and Vite proxy are removed. Netlify remains production-only.
