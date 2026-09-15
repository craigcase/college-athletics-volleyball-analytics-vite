import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = new URL('../../supabase/migrations/202609090001_initial.sql', import.meta.url);

test('initial Postgres migration contains required canonical, evidence, analytics, and audit tables', async () => {
  const sql = await readFile(migration, 'utf8');
  const required = [
    'programs','seasons','program_memberships','teams','team_aliases','team_seasons',
    'players','player_aliases','player_seasons','matches','match_sets','source_lineages',
    'source_artifacts','match_source_links','evidence_observations','canonical_overrides',
    'reconciliation_issues','match_capabilities','match_team_totals','player_match_totals',
    'match_metric_results','match_findings','activity_events'
  ];
  for (const table of required) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i'), `missing ${table}`);
});

test('Postgres schema prevents duplicate source bytes and duplicate match/source links', async () => {
  const sql = await readFile(migration, 'utf8');
  assert.match(sql, /UNIQUE\s*\(program_id,\s*content_hash\)/i);
  assert.match(sql, /UNIQUE\s*\(match_id,\s*source_artifact_id\)/i);
  assert.match(sql, /canonical_revision\s+INTEGER\s+NOT NULL\s+DEFAULT\s+1/i);
});

test('staff override table preserves source-neutral sticky field targeting', async () => {
  const sql = await readFile(migration, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_overrides/i);
  assert.match(sql, /entity_type\s+TEXT\s+NOT NULL/i);
  assert.match(sql, /field_name\s+TEXT\s+NOT NULL/i);
  assert.match(sql, /canonical_value_json\s+TEXT\s+NOT NULL/i);
  assert.match(sql, /UNIQUE\s*\(program_id,\s*entity_type,\s*entity_id,\s*field_name\)/i);
});

const rallyMigration = new URL('../../supabase/migrations/202609130002_rally_analytics.sql', import.meta.url);

test('rally analytics migration adds canonical rally tables, capabilities, indexes, grants, and user-scoped RLS', async () => {
  const sql = await readFile(rallyMigration, 'utf8');
  const tables = ['match_rallies','rally_phases','rally_events','match_timeline_events','rally_source_links','rally_rotation_states'];
  for (const table of tables) assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}\\b`, 'i'), `missing ${table}`);
  for (const capability of ['terminal_event_detail','timeout_timeline','substitution_timeline','offensive_phase','transition_depth','contact_sequence','timestamps']) {
    assert.match(sql, new RegExp(`\\b${capability}\\b`, 'i'), `missing capability ${capability}`);
  }
  assert.match(sql, /create or replace function private\.can_access_rally\(p_rally_id text\)/i);
  assert.match(sql, /grant execute on function private\.can_access_rally\(text\) to authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.match_rallies to authenticated/i);
  assert.match(sql, /private\.can_access_match\(match_id\)/i);
  assert.match(sql, /private\.can_access_rally\(rally_id\)/i);
  assert.match(sql, /create index[\s\S]*match_rallies\s*\(match_id,\s*canonical_revision,\s*set_number,\s*rally_number\)/i);
  assert.match(sql, /alter table public\.match_sets[\s\S]*rally_score_status/i);
  assert.match(sql, /source_final_score_json/i);
});

const evidenceQualityMigration = new URL('../../supabase/migrations/202609140001_import_evidence_quality.sql', import.meta.url);

test('v0.7.2 evidence-quality migration adds program-scoped aliases, correction permission, and override history', async () => {
  const sql = await readFile(evidenceQualityMigration, 'utf8');
  assert.match(sql, /alter table public\.program_memberships[\s\S]*can_correct_data\s+boolean/i);
  assert.match(sql, /create table(?: if not exists)? public\.program_opponent_aliases\b/i);
  assert.match(sql, /program_id\s+text\s+not null\s+references public\.programs/i);
  assert.match(sql, /normalized_alias\s+text\s+not null/i);
  assert.match(sql, /unique\s*\(program_id,\s*normalized_alias\)/i);
  assert.match(sql, /revoked_at\s+timestamptz/i);
  assert.match(sql, /create table(?: if not exists)? public\.canonical_override_history\b/i);
  assert.match(sql, /action\s+text\s+not null/i);
  assert.match(sql, /previous_value_json/i);
  assert.match(sql, /new_value_json/i);
  assert.match(sql, /uniquely_reconciled/i);
  assert.match(sql, /create or replace function private\.can_correct_program_data\(p_program_id text\)/i);
  assert.match(sql, /create or replace function private\.ensure_owner_can_correct_data\(\)/i);
  assert.match(sql, /create trigger program_memberships_owner_correction_default/i);
  assert.match(sql, /program_opponent_aliases_member_select/i);
  assert.match(sql, /program_opponent_aliases_corrector_write/i);
  assert.match(sql, /canonical_overrides_corrector_write/i);
  assert.match(sql, /canonical_override_history_corrector_insert/i);
  assert.doesNotMatch(sql, /create policy canonical_override_history_member_all/i);
});
