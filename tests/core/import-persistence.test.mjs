import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('roster and schedule functions preserve a source before canonical writes and pass its artifact id', async () => {
  for (const path of ['../../netlify/functions/roster-import.ts','../../netlify/functions/schedule-import.ts']) {
    const source = await read(path);
    const preserve = source.indexOf('await preserveSource(');
    const upsert = source.indexOf(path.includes('roster') ? 'await upsertRosterEvidence(' : 'await upsertScheduleEvidence(');
    assert.ok(preserve >= 0 && upsert > preserve, `${path} must preserve source first`);
    assert.match(source, /sourceArtifactId:source\.id/);
  }
});

test('Supabase roster persistence retains source observations duplicate protection and staff overrides', async () => {
  const source = await read('../../db/repositories/roster.ts');
  assert.match(source, /canonical_overrides/);
  assert.match(source, /source_artifact_id:input\.sourceArtifactId/);
  assert.match(source, /existingFields/);
  assert.match(source, /upsert\([^;]+onConflict:'player_id,alias'/s);
  assert.match(source, /isNumberName/);
});

test('Supabase schedule persistence keeps one match attaches source links and records imported fields', async () => {
  const source = await read('../../db/repositories/schedule.ts');
  assert.match(source, /onConflict:'match_id,source_artifact_id'/);
  assert.match(source, /source_artifact_id:input\.sourceArtifactId/);
  assert.match(source, /planScheduleRefresh/);
  assert.match(source, /schedule_change/);
});

test('match evidence increments canonical revision before deterministic recalculation', async () => {
  const source = await read('../../db/repositories/matches.ts');
  const revision = source.indexOf("update({canonical_revision:revision");
  const recalculate = source.indexOf('await recalculateMatch(');
  assert.ok(revision >= 0 && recalculate > revision);
});
