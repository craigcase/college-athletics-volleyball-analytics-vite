import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('tests/fixtures/v070/public/mayville-pbp.html', 'utf8');

test('public Sidearm parser preserves box totals and emits set-grouped play by play', async () => {
  const { parsePublicBoxScoreHtml } = await import('../../.core-dist/lib/ingestion/match/public-boxscore.js');
  const parsed = parsePublicBoxScoreHtml(html, 'https://vcsuvikings.com/sports/womens-volleyball/stats/2026/mayville-state-university/boxscore/6523', { ourTeamNames: ['Valley City State','Valley City','VCSU','VC'] });
  assert.equal(parsed.producer, 'public_sidearm');
  assert.equal(parsed.match.opponentName, 'Mayville State');
  assert.equal(parsed.observations.find(o => o.entityKey === 'us' && o.field === 'kills')?.value, 51);
  assert.equal(parsed.timeline.scoringRecords.length, 5);
  assert.deepEqual(parsed.timeline.setFinalScores, [
    { setNumber: 1, score: { our: 2, opponent: 1 } },
    { setNumber: 2, score: { our: 1, opponent: 1 } },
  ]);
  assert.equal(parsed.timeline.scoringRecords[0].setNumber, 1);
  assert.equal(parsed.timeline.scoringRecords[0].servingSide, 'opponent');
  assert.equal(parsed.timeline.scoringRecords[0].pointWinner, 'our_team');
  assert.deepEqual(parsed.timeline.scoringRecords[0].scoreAfter, { our: 1, opponent: 0 });
  assert.equal(parsed.timeline.timelineEvents.filter(e => e.type === 'timeout').length, 1);
  assert.equal(parsed.timeline.scoringRecords.at(-1).setNumber, 2);
});
