# Migration Verification — v0.7.0

## Required SQL

Apply migrations in this order if the database is already current through v0.6.6:

1. `supabase/migrations/202609130002_rally_analytics.sql`

The migration should complete without dropping or replacing existing canonical/evidence tables.

## Schema checks

After applying the migration, confirm:

- `match_sets` has `rally_score_status`, `source_final_score_json`, and `rally_canonical_revision`.
- `match_capabilities` has `terminal_event_detail`, `timeout_timeline`, `substitution_timeline`, `offensive_phase`, `transition_depth`, `contact_sequence`, and `timestamps`.
- `match_rallies`, `rally_phases`, `rally_events`, `match_timeline_events`, `rally_source_links`, and `rally_rotation_states` exist.
- Authenticated grants and user-scoped RLS policies exist for the new rally tables.

## StackBlitz verification

Run:

```bash
npm install
npm run verify
npm run dev
```

Then re-import the Mayville official XML and confirm the existing Sept. 2 canonical match is enriched rather than duplicated. Expected evidence-backed baselines are 195 canonical rallies from 193 explicit scoring records plus two gap placeholders; VCSU Sideout is 49/94, Point Scored is 53/101, Score1 is 23/47, and SOS2 is 13/47. Unsupported contact-level metrics such as T3 hitting percentage must remain unavailable.

Import College of Saint Mary to exercise the Presto continuity-gap path. Later supported rallies should remain usable after the localized gap.

The Mount Mercy Set 1 fixture intentionally contains a source contradiction: official line score 27-25, source PBP final 28-24. Expected behavior is an explicit rally-score conflict and no match-level rally analytics for that match; the application must not flip an arbitrary rally to force agreement.

## Coach's Edge acceptance

Ask:

```text
What was our sideout percentage against Mayville?
How often did we score the first point after siding out?
How many SOS2 opportunities did we convert?
How long were our best serving runs?
What was our T3 hitting percentage?
Was our hitting percentage advantage one of the strongest findings?
```

The first four should answer from persisted deterministic rally metrics. T3 should refuse safely for insufficient contact evidence. The hitting-finding question should explain that the .042 difference is below the .050 finding threshold rather than presenting it as a promoted finding.

# Migration Verification — v0.6.1

## v0.6.3 public-source Edge fetch relay

StackBlitz URL imports now use one authenticated Supabase Edge Function (`fetch-public-source`) when the WebContainer cannot act as a normal internet-facing server. The relay only retrieves validated public HTTP(S) evidence and returns the bytes to the existing parser/persistence pipeline; roster, schedule, match reconciliation, analytics, and database writes remain in the normal application code. This is a one-time Supabase deployment and does not change the regular GitHub → refresh StackBlitz → guided-test workflow. See `SUPABASE_EDGE_FUNCTION_SETUP.md`.

## Request-scoped database client

- `scripts/local-dev-server.ts` imports `../db/client.js`.
- Every repository under `db/repositories/` imports `../client.js`.
- `lib/services/import-match.ts` imports `../../db/client.js`.
- Regression tests reject extensionless imports of the request-scoped client.

## Local security boundary

- Local development sets `SUPABASE_DB_ACCESS_MODE=user-scoped-only`.
- Local development removes `SUPABASE_SECRET_KEY` from `process.env` before serving requests.
- `getAdminClient()` refuses secret-key fallback while the local user-scoped mode is active.
- Authenticated API requests continue to use the publishable key plus the signed-in user's JWT under Supabase RLS.

## Supabase

- Initial schema remains `202609090001_initial.sql`.
- User-scoped migration remains `202609120001_user_scoped_rls.sql`.
- **No additional SQL migration is required for v0.6.1.**

## Verification commands

```bash
npm install
npm run verify
npm run dev
```

Unauthenticated smoke test:

```bash
curl -i --max-time 5 http://127.0.0.1:5173/api/program
```

Expected: `401 Unauthorized` with `{"error":"UNAUTHENTICATED"}`.

The acceptance test is signing in through the Preview and completing **Create Program** without a secret-key browser error.

## v0.6.2 StackBlitz request scope

StackBlitz local API requests no longer rely on Node AsyncLocalStorage. WebContainer requests are serialized and hold one explicit user-scoped Supabase client for the full request, including across browser-hosted network awaits. Local development remains secret-key-disabled. No new Supabase migration is required for v0.6.2.

## v0.6.4 authenticated import token fix

- Preserves the verified bearer token alongside the authenticated user so program-scoped imports can pass the same access token to the public-source fetch relay.
- Fixes the `token is not defined` failure affecting schedule, matches, and import endpoints in v0.6.3.

