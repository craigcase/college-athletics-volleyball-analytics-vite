import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('recalculation appends canonical rally metrics without replacing box-score analytics', async()=>{
  const source=await read('../../db/repositories/analytics.ts');
  assert.match(source,/loadCanonicalRallies/);
  assert.match(source,/calculateMatchAnalytics/);
  assert.match(source,/calculateRallyAnalytics/);
  assert.match(source,/const metrics=\[\.\.\.boxMetrics,\.\.\.rallyMetrics\]/);
  assert.match(source,/numerator:m\.numerator\?\?null/);
});

test('stored metrics expose numerator and opportunity denominator for evidence-aware display',async()=>{
  const source=await read('../../db/repositories/analytics.ts');
  assert.match(source,/select\('match_id,subject,metric_code,value,numerator,denominator,engine_version'\)/);
  assert.match(source,/numerator:r\.numerator/);
  assert.match(source,/opportunities:r\.denominator/);
});

test('match summary exposes rally metrics, sideout pathways, unsupported slices, and service runs',async()=>{
  const source=await read('../../db/repositories/analytics.ts');
  assert.match(source,/rallyAnalytics/);
  assert.match(source,/sideoutPathways/);
  assert.match(source,/first_ball_sideout/);
  assert.match(source,/regular_sideout/);
  assert.match(source,/unknown_phase/);
  assert.match(source,/unsupported/);
  assert.match(source,/serviceRuns/);
});

test('browser summary contract types rally analytics instead of using any',async()=>{
  const source=await read('../../src/lib/types.ts');
  assert.match(source,/rallyAnalytics:/);
  assert.match(source,/sideoutPathways:/);
  assert.match(source,/serviceRuns:/);
  assert.match(source,/unsupported:string\[\]/);
});


test('match summary suppresses rally calculations and explains score-integrity conflicts',async()=>{
  const source=await read('../../db/repositories/analytics.ts');
  assert.match(source,/loadRallyScoreIntegrity/);
  assert.match(source,/scoreIntegrity/);
  assert.match(source,/source PBP conflicts with the official set score/i);
});
