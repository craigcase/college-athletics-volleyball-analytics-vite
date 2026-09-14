import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('rally repository exposes deterministic replacement and load interfaces', async () => {
  const source = await read('../../db/repositories/rallies.ts');
  assert.match(source, /export async function replaceCanonicalTimeline/);
  assert.match(source, /export async function loadCanonicalRallies/);
  assert.match(source, /match_rallies/);
  assert.match(source, /match_timeline_events/);
  assert.match(source, /rally_source_links/);
  assert.match(source, /rally_rotation_states/);
  assert.match(source, /delete\(\)[\s\S]*canonical_revision/);
});

test('match import uses parser v2 and persists canonical timeline before recalculation', async () => {
  const source = await read('../../lib/services/import-match.ts');
  assert.match(source, /PARSER_VERSION\s*=\s*['"]ingestion-2\.0\.0['"]/);
  const preserve = source.indexOf('await preserveSource(');
  const parse = source.indexOf('parseMatchSource(');
  const attach = source.indexOf('await attachEvidenceToMatch(');
  const build = source.indexOf('buildCanonicalTimeline(');
  const rotations = source.indexOf('deriveServingCycle(');
  const persist = source.indexOf('await replaceCanonicalTimeline(');
  const recalculate = source.indexOf('await recalculateMatch(');
  assert.ok(preserve >= 0 && parse > preserve, 'raw source must be preserved before parsing');
  assert.ok(attach > parse, 'generic evidence must attach after parsing');
  assert.ok(build > attach, 'timeline is built after evidence attaches and revision advances');
  assert.ok(rotations > build, 'rotation derivation follows canonical timeline construction');
  assert.ok(persist > rotations, 'canonical timeline persists after rotation derivation');
  assert.ok(recalculate > persist, 'analytics must recalculate only after canonical rallies persist');
});

test('duplicate source bytes retain parser version so old parser artifacts can be reprocessed', async () => {
  const sources = await read('../../db/repositories/sources.ts');
  const service = await read('../../lib/services/import-match.ts');
  assert.match(sources, /parser_version/);
  assert.match(sources, /parserVersion/);
  assert.match(service, /source\.parserVersion\s*===\s*PARSER_VERSION/);
  assert.match(service, /updateSourceParserVersion/);
});


test('match import records official-vs-source rally score conflicts for review before analytics', async () => {
  const source = await read('../../lib/services/import-match.ts');
  assert.match(source, /setScoreIntegrity/);
  assert.match(source, /rally_score_conflict/);
  assert.match(source, /reconciliation_issues/);
});
