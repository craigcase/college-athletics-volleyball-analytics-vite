import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('match imports preserve evidence before parsing or reconciliation', async () => {
  const service = await readFile(new URL('../../lib/services/import-match.ts', import.meta.url), 'utf8');
  const repository = await readFile(new URL('../../db/repositories/sources.ts', import.meta.url), 'utf8');
  const preserve = service.indexOf('await preserveSource(');
  const parse = service.indexOf('parseMatchSource({');
  const reconcile = service.indexOf('await resolveMatchForEvidence(');
  assert.ok(preserve >= 0 && preserve < parse && parse < reconcile);
  const storageWrite = repository.indexOf('.storage.from(');
  const artifactWrite = repository.indexOf("const artifact=await db.from('source_artifacts').insert");
  assert.ok(storageWrite >= 0 && storageWrite < artifactWrite);
});

test('an unlinked duplicate match source is parsed again so it can attach after its schedule match exists', async () => {
  const service = await readFile(new URL('../../lib/services/import-match.ts', import.meta.url), 'utf8');
  assert.match(service, /if\(source\.duplicate&&linkedMatchId\)/);
});

test('roster re-import keeps numeric-name repair and staff override protection', async () => {
  const repository = await readFile(new URL('../../db/repositories/roster.ts', import.meta.url), 'utf8');
  assert.match(repository, /isNumberName/);
  assert.match(repository, /canonical_overrides/);
  assert.match(repository, /player_aliases/);
});

test('canonical match totals and deterministic analytics are persisted through Supabase repositories', async () => {
  const matches = await readFile(new URL('../../db/repositories/matches.ts', import.meta.url), 'utf8');
  const analytics = await readFile(new URL('../../db/repositories/analytics.ts', import.meta.url), 'utf8');
  assert.match(matches, /evidence_observations/);
  assert.match(matches, /canonical_revision/);
  assert.match(analytics, /match_team_totals/);
  assert.match(analytics, /match_metric_results/);
  assert.match(analytics, /match_findings/);
});
