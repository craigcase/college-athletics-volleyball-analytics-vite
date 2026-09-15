# Migration Notes — v0.7.2

## Import review and evidence quality

Apply `supabase/migrations/202609140001_import_evidence_quality.sql` **after** `202609130002_rally_analytics.sql` before testing v0.7.2. The migration is additive and preserves existing raw sources, canonical match/rally data, analytics, authentication, and user-scoped RLS.

The migration adds:

- `program_memberships.can_correct_data` for explicit coach/admin data-correction permission; program owners are enabled by default;
- `program_opponent_aliases` for program-specific, auditable trusted opponent-name confirmations;
- `canonical_override_history` for append-only correction/undo history;
- expanded `match_rallies.evidence_status` values supporting `uniquely_reconciled` and `staff_confirmed`.

### Import and evidence behavior

- Match-identity ambiguity is blocking and now enters **Match Import Review** immediately.
- Confirmed opponent-name variants are stored as program-specific trusted aliases; they are not global replacements.
- One program-owned Sidearm URL is parsed for maximum safe evidence, including team/player totals, set attack totals, substitutions, timeouts, starter/on-court statements, and explicit terminal attribution when present.
- PBP is audited against official totals. A missing fact is filled only when exactly one mathematical reconciliation is possible. Otherwise the unknown remains local to the affected metric.
- Every completed import returns an **Import Quality Summary**. Match pages expose a secondary compact **Data Quality & Match Timeline** for inspection.
- Authorized corrections are overlays above immutable raw source evidence, are reversible, and trigger deterministic recalculation. Optional correction reasons are preserved in audit history.

### Acceptance references

- Mayville remains the v0.7.1 regression for canonical rally analytics and Coach's Edge SOS2.
- Benedictine is the clean Presto/control case and Match Import Review/trusted-alias acceptance case.
- College of Saint Mary exercises a localized unresolved PBP gap.
- Mount Mercy remains the structural set-score contradiction/fail-safe case.

# Migration Notes — v0.7.0

## Rally analytics foundation

Apply `supabase/migrations/202609130002_rally_analytics.sql` **after** `202609130001_program_identity_settings.sql` and before re-importing match evidence for rally analytics. The migration is additive: existing match, evidence, box-score analytics, program identity, authentication, and RLS behavior remain in place.

The migration adds canonical rally storage (`match_rallies`, `rally_phases`, `rally_events`, `match_timeline_events`, `rally_source_links`, and `rally_rotation_states`), new rally-capability fields on `match_capabilities`, and set-level rally-score integrity fields on `match_sets`. It also adds authenticated grants and user-scoped RLS for the new tables.

### Evidence and reconciliation behavior

- Raw imported bytes remain preserved before parsing.
- PrestoSports and Volleyball LiveStats XML feed the same canonical rally model through producer-specific adapters; public Sidearm PBP is also supported.
- Score gaps create localized canonical placeholders. Deterministic serving/receiving team side may be recovered from the previous point winner, but server-player identity, terminal event, phase, and attribution are not invented.
- If source PBP cannot reconcile to the official set final without changing an explicit point winner, the official score remains canonical in `match_sets`, the source final is retained separately, a `rally_score_conflict` issue is recorded, and match-level rally analytics are withheld until resolved.

### Product scope

The old GSC/conference-stat and conference-benchmarking concept is retired. VolleyMetrics remains deferred optional enrichment; it is not required for the v0.7.0 VCSU path.


## v0.6.6 Program identity settings

Apply `supabase/migrations/202609130001_program_identity_settings.sql` after the v0.6.0 RLS migration. It adds nullable `programs.school_name` for existing programs and adds a seven-argument authenticated `create_volleyball_program` overload for new programs. Existing program data is preserved; owners can populate the full university name from Program Settings.

# Migration Notes — v0.6.1

## v0.6.3 public-source Edge fetch relay

StackBlitz URL imports now use one authenticated Supabase Edge Function (`fetch-public-source`) when the WebContainer cannot act as a normal internet-facing server. The relay only retrieves validated public HTTP(S) evidence and returns the bytes to the existing parser/persistence pipeline; roster, schedule, match reconciliation, analytics, and database writes remain in the normal application code. This is a one-time Supabase deployment and does not change the regular GitHub → refresh StackBlitz → guided-test workflow. See `SUPABASE_EDGE_FUNCTION_SETUP.md`.

v0.6.1 fixes the StackBlitz request-scope regression discovered after the v0.6.0 RLS migration.

The local API wrapper and every database repository now import the same request-scoped Supabase client module using canonical `.js` ESM specifiers. This keeps the signed-in user's `AsyncLocalStorage` database scope intact from the HTTP request wrapper through repository calls.

The StackBlitz runtime is now explicitly `user-scoped-only`. It deletes any inherited `SUPABASE_SECRET_KEY` before serving requests and `db/client.ts` refuses privileged fallback in this mode. A stale secret in StackBlitz can therefore no longer mask a lost request scope or trigger Supabase's "Forbidden use of secret API key in browser" error.

No new SQL is required. Keep the v0.6.0 `202609120001_user_scoped_rls.sql` migration already applied.

## v0.6.2 StackBlitz request scope

StackBlitz local API requests no longer rely on Node AsyncLocalStorage. WebContainer requests are serialized and hold one explicit user-scoped Supabase client for the full request, including across browser-hosted network awaits. Local development remains secret-key-disabled. No new Supabase migration is required for v0.6.2.

## v0.6.4 authenticated import token fix

- Preserves the verified bearer token alongside the authenticated user so program-scoped imports can pass the same access token to the public-source fetch relay.
- Fixes the `token is not defined` failure affecting schedule, matches, and import endpoints in v0.6.3.

