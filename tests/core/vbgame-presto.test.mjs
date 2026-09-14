import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const xml = await readFile('tests/fixtures/v070/vcsu/08-21-26CSMGame.xml', 'utf8');

test('Presto adapter parses real VCSU scoring timeline and supported team totals', async () => {
  const { parsePrestoVbgame } = await import('../../.core-dist/lib/ingestion/match/vbgame/presto.js');
  const parsed = parsePrestoVbgame(xml, 'upload://08-21-26CSMGame.xml', ['Valley City State','VCSU','VCS']);
  assert.equal(parsed.producer, 'presto_vbgame');
  assert.equal(parsed.match.date, '2026-08-21');
  assert.equal(parsed.match.opponentName, 'College of Saint Mary (NE)');
  assert.equal(parsed.match.homeAway, 'neutral');
  assert.deepEqual(parsed.match.setScores, ['16-25','25-23','14-25','16-25']);
  assert.equal(parsed.timeline.scoringRecords[0].scoreAfter.our, 1);
  assert.equal(parsed.timeline.scoringRecords[0].scoreAfter.opponent, 0);
  assert.equal(parsed.timeline.scoringRecords[0].servingSide, 'our_team');
  assert.equal(parsed.timeline.scoringRecords[0].pointWinner, 'our_team');
  assert.equal(parsed.timeline.scoringRecords[0].terminal.type, 'stuff_block');
  assert.equal(parsed.timeline.timelineEvents.some(e => e.type === 'timeout'), true);

  const get = (side, field) => parsed.observations.find(o => o.entityKey === side && o.field === field)?.value;
  assert.equal(get('us','kills'), 29);
  assert.equal(get('us','attack_errors'), 32);
  assert.equal(get('us','attack_attempts'), 123);
  assert.equal(get('us','aces'), 3);
  assert.equal(get('us','service_errors'), 5);
  assert.equal(get('opponent','kills'), 49);
});
