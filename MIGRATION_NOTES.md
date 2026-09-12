# Migration notes

The Sites/Next implementation is archived. This build intentionally does not carry forward framework middleware, server components, D1/R2 bindings, or ChatGPT Sites authentication headers.

Portable domain modules remain under `lib/` and `db/repositories/`. The browser app lives under `src/`; privileged HTTP operations live under `netlify/functions/`.
