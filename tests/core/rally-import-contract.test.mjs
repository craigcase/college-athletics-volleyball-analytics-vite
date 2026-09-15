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
  assert.match(source, /PARSER_VERSION\s*=\s*['"]ingestion-2\.1\.2['"]/);
  const importStart = source.indexOf('export async function importMatchBytes');
  const preserve = source.indexOf('await preserveSource(', importStart);
  const parse = source.indexOf('parseMatchSource(', importStart);
  const finalizeCall = source.indexOf('return finalizeMatchImport(', importStart);
  const finalizeStart = source.indexOf('export async function finalizeMatchImport');
  const attach = source.indexOf('await attachEvidenceToMatch(', finalizeStart);
  const build = source.indexOf('buildCanonicalTimeline(', finalizeStart);
  const audit = source.indexOf('auditTimelineAgainstTotals(', finalizeStart);
  const rotations = source.indexOf('deriveServingCycle(', finalizeStart);
  const persist = source.indexOf('await replaceCanonicalTimeline(', finalizeStart);
  const recalculate = source.indexOf('await recalculateMatch(', finalizeStart);
  assert.ok(preserve >= 0 && parse > preserve, 'raw source must be preserved before parsing');
  assert.ok(finalizeCall > parse, 'parsed evidence must flow into finalization after match identity resolves');
  assert.ok(attach > finalizeStart, 'generic evidence attaches inside finalization');
  assert.ok(build > attach, 'timeline is built after evidence attaches and revision advances');
  assert.ok(audit > build, 'evidence audit follows canonical timeline construction');
  assert.ok(rotations > audit, 'rotation derivation follows reconciled canonical timeline');
  assert.ok(persist > rotations, 'canonical timeline persists after rotation derivation');
  assert.ok(recalculate > persist, 'analytics must recalculate only after canonical rallies persist');
  assert.match(source, /buildImportQualitySummary/);
  assert.match(source, /quality,analytics/);
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
