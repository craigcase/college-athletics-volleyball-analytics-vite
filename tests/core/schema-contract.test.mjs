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
