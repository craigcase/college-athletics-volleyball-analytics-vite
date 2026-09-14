import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCanonicalMatch } from '../../.core-dist/lib/ingestion/match/resolve-match.js';

test('match evidence enriches a confident schedule match instead of creating a duplicate', () => {
  const result = resolveCanonicalMatch({
    evidence: { date: '2026-09-05', opponentName: 'Mayville State University', homeAway: 'away', setScores: ['25-20','25-23','23-25','25-21'] },
    candidates: [
      { id: 'match-1', date: '2026-09-05', opponentNames: ['Mayville State','Mayville State University'], homeAway: 'away', setScores: ['25-20','25-23','23-25','25-21'] },
      { id: 'match-2', date: '2026-09-12', opponentNames: ['Jamestown'], homeAway: 'home' },
    ],
  });
  assert.deepEqual(result, { status: 'matched', matchId: 'match-1', confidence: 1 });
});

test('ambiguous same-day candidates are surfaced instead of guessed', () => {
  const result = resolveCanonicalMatch({
    evidence: { date: '2026-09-05', opponentName: 'Dakota State' },
    candidates: [
      { id: 'a', date: '2026-09-05', opponentNames: ['Dakota State'] },
      { id: 'b', date: '2026-09-05', opponentNames: ['Dakota State'] },
    ],
  });
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidateIds, ['a','b']);
});


test('institutional suffix differences do not block an otherwise exact opponent match', () => {
  const result = resolveCanonicalMatch({
    evidence: { date: '2026-09-02', opponentName: 'Mayville State', homeAway: 'away', sourceMatchId: '121' },
    candidates: [
      { id: 'match-mayville', date: '2026-09-02', opponentNames: ['Mayville State University'], homeAway: 'away', sourceMatchIds: ['6523'] },
    ],
  });
  assert.deepEqual(result, { status: 'matched', matchId: 'match-mayville', confidence: 0.85 });
});
