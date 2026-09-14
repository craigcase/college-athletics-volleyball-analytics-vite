import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mayvilleXml = await readFile('tests/fixtures/v070/vcsu/09-2-26MayvilleGame.xml', 'utf8');
const montanaXml = await readFile('tests/fixtures/v070/vcsu/09-4MontanaWesternGame.xml', 'utf8');

test('LiveStats adapter parses real Mayville timeline despite misleading complete flag and team orientation', async () => {
  const { parseLiveStatsVbgame } = await import('../../.core-dist/lib/ingestion/match/vbgame/livestats.js');
  const parsed = parseLiveStatsVbgame(mayvilleXml, 'upload://09-2-26MayvilleGame.xml', ['Valley City State','Valley City','VC','VCSU']);
  assert.equal(parsed.producer, 'livestats_vbgame');
  assert.equal(parsed.match.opponentName.trim(), 'Mayville State');
  assert.equal(parsed.match.date, '2026-09-02');
  assert.equal(parsed.match.homeAway, 'away');
  assert.deepEqual(parsed.match.setScores, ['29-27','23-25','25-23','25-18']);
  assert.equal(parsed.timeline.scoringRecords.length, 193);
  assert.equal(parsed.timeline.setFinalScores.reduce((n,s)=>n+s.score.our+s.score.opponent,0), 195);
  assert.equal(parsed.timeline.timelineEvents.some(e => e.type === 'timeout'), true);

  const types = parsed.timeline.scoringRecords.map(r => r.terminal?.type).filter(Boolean);
  assert.ok(types.includes('service_error'));
  assert.ok(types.includes('service_ace'));
  assert.ok(types.includes('attack_error'));
  assert.ok(types.includes('setting_error'));
  assert.ok(types.includes('kill'));
  assert.ok(types.includes('stuff_block'));
});

test('LiveStats adapter also parses Montana Western with home VCSU orientation', async () => {
  const { parseLiveStatsVbgame } = await import('../../.core-dist/lib/ingestion/match/vbgame/livestats.js');
  const parsed = parseLiveStatsVbgame(montanaXml, 'upload://09-4MontanaWesternGame.xml', ['Valley City State','Valley City','VCS','VCSU']);
  assert.equal(parsed.match.opponentName, 'Montana Western');
  assert.equal(parsed.match.date, '2026-09-04');
  assert.equal(parsed.match.homeAway, 'home');
  assert.equal(parsed.timeline.scoringRecords.length, 222);
});
