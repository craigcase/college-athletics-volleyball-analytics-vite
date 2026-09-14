# College Athletics Consulting — Volleyball Analytics

## v0.7.0 Rally analytics stress-test engine

- Adds source-specific play-by-play ingestion for **PrestoSports** and **Volleyball LiveStats In-Arena Tool** XML plus public Sidearm play-by-play.
- Builds a canonical Match → Set → Rally timeline while preserving raw source evidence and source-record links.
- Recovers deterministic serving/receiving **team side** from rally-scoring continuity when source server labels are missing or contradictory; unsupported server-player identity remains missing.
- Calculates evidence-gated **Sideout %, Point Scored %, Score1, SOS2, EPO, service runs, and longest service run** from canonical rallies.
- Treats an opponent service error as an unearned FBSO (`given`) and an ace as a direct serving point. Ordinary terminal-only PBP does not fabricate first-ball-vs-later-sideout, T1/T2/T3+, Good Dig, contact quality, attack location, or exact on-court personnel.
- Adds Rally Analytics to Match Summary and persisted rally questions to Coach's Edge.
- Stress-tests nine real VCSU XML files: seven PrestoSports and two LiveStats files. Mayville reconciles to 195 canonical rallies with two localized PBP gap placeholders; College of Saint Mary exercises the Presto gap-recovery path.
- Fails safely on contradictory evidence. The Mount Mercy source says 27-25 in the official line score but its PBP ends 28-24 in Set 1; v0.7.0 preserves both, records a reconciliation conflict, and withholds match-level rally analytics instead of guessing which rally is wrong.
- Retires the old GSC/conference-stat and conference-benchmarking concept from the current product. VolleyMetrics remains a later optional enrichment source, not a VCSU requirement.

**Database update required:** apply `supabase/migrations/202609130002_rally_analytics.sql` after the v0.6.6 program identity migration and before re-importing match evidence.


## v0.6.6 Coach's Edge findings + Program Settings

- Connects Coach's Edge to persisted deterministic `match_findings` so questions such as “Where did we have the biggest statistical edge?” can use the ranked finding already stored for the canonical match.
- Improves direct comparison language and broadens natural tactical/personnel prescription guards.
- Adds Program Settings for full university name, school abbreviation, mascot/team name, and school colors.
- Keeps app branding centered on abbreviation, mascot, and colors; abbreviation and mascot are normalized to uppercase.
- Adds full university name as a preserved team alias for future public-source matching.
- Corrects finding direction for service errors so fewer service errors is treated as the advantage.

**Database update required:** apply `supabase/migrations/202609130001_program_identity_settings.sql` before testing Program Settings. Existing programs remain valid; `school_name` starts blank until the owner saves settings.

## v0.6.5 Coach's Edge product hardening

- Displays hitting percentage in volleyball-native notation such as `.153` instead of `15.3%`.
- Expands current-match Coach's Edge questions across the six Analytics Engine 1.0.0 metrics: hitting percentage, kills, attack errors, attack attempts, aces, and service errors.
- Supports our-team, opponent-only, and team-vs-opponent natural-language questions without calculating outside persisted deterministic metrics.
- Distinguishes missing rotation evidence from rotation evidence that exists but is not yet supported by the Coach's Edge resolver.
- Replaces developer-facing query-vocabulary language with coach-facing explanations.

## v0.6.3 public-source Edge fetch relay

StackBlitz URL imports now use one authenticated Supabase Edge Function (`fetch-public-source`) when the WebContainer cannot act as a normal internet-facing server. The relay only retrieves validated public HTTP(S) evidence and returns the bytes to the existing parser/persistence pipeline; roster, schedule, match reconciliation, analytics, and database writes remain in the normal application code. This is a one-time Supabase deployment and does not change the regular GitHub → refresh StackBlitz → guided-test workflow. See `SUPABASE_EDGE_FUNCTION_SETUP.md`.

The current architecture preserves the fast development loop: **GitHub → StackBlitz → guided testing**. StackBlitz runs the React app and the local API on one port, but database/storage access is scoped to the signed-in Supabase user through Row Level Security. No Supabase secret key is required for local development.

## StackBlitz development

```bash
npm install
npm run verify
npm run dev
```

`npm run dev` builds the Vite client into `dist/`, then starts one local server on port **5173**. `/api/*` uses the same application handlers as production, but each authenticated local request creates a Supabase client with the project publishable key plus that user's JWT. All authorization is enforced by Postgres/Storage RLS.

Local `.env` needs only:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Do not put `SUPABASE_SECRET_KEY` in StackBlitz. v0.6.1 also hard-disables the privileged secret-key fallback in the local runtime, so an old secret left in `.env` cannot be used accidentally.

## One-time Supabase update (introduced in v0.6.0)

The existing database was created with fail-closed RLS and no browser/user policies. Run these migrations in order in Supabase SQL Editor:

1. `supabase/migrations/202609090001_initial.sql` — already applied on existing projects.
2. `supabase/migrations/202609120001_user_scoped_rls.sql` — introduced in v0.6.0 and still required.
3. `supabase/migrations/202609130001_program_identity_settings.sql` — introduced in v0.6.6; adds full university name and the expanded authenticated program-creation contract.
4. `supabase/migrations/202609130002_rally_analytics.sql` — introduced in v0.7.0; adds canonical rally/timeline/source-link/rotation tables, rally capability fields, set-level rally-score integrity fields, grants, and user-scoped RLS.

The RLS migration adds user-scoped RLS, Storage policies, and authenticated program bootstrap. The v0.6.6 identity migration extends that bootstrap without changing the authorization model. The v0.7.0 migration is additive and keeps existing box-score evidence and analytics intact.

## Architecture

- Vite + React + TypeScript frontend
- Supabase Auth + Postgres + Storage
- Deterministic TypeScript analytics
- One local StackBlitz server for guided testing
- Netlify remains an optional production hosting/serverless target, not part of the ordinary development loop

Coach's Edge reads stored deterministic analytics. It does not invent or calculate statistics with an LLM.


## v0.6.1 request-scope fix

v0.6.1 normalizes every import of the request-scoped Supabase database client to the same ESM module path (`db/client.js`). This prevents StackBlitz/tsx from creating separate module instances where the API wrapper sets an `AsyncLocalStorage` scope in one instance but a repository reads from another. Local development also forces `SUPABASE_DB_ACCESS_MODE=user-scoped-only` and removes `SUPABASE_SECRET_KEY` from the running process before requests are handled.

There is **no new Supabase SQL migration** for v0.6.1. If `202609120001_user_scoped_rls.sql` already returned `Success. No rows returned`, move directly to code verification and Program Setup testing.

## v0.6.2 StackBlitz request scope

StackBlitz local API requests no longer rely on Node AsyncLocalStorage. WebContainer requests are serialized and hold one explicit user-scoped Supabase client for the full request, including across browser-hosted network awaits. Local development remains secret-key-disabled. No new Supabase migration is required for v0.6.2.

## v0.6.4 authenticated import token fix

- Preserves the verified bearer token alongside the authenticated user so program-scoped imports can pass the same access token to the public-source fetch relay.
- Fixes the `token is not defined` failure affecting schedule, matches, and import endpoints in v0.6.3.

