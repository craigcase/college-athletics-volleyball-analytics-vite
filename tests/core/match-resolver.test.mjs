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

test('Benedictine naming mismatch stays reviewable while date and neutral evidence rank the correct candidate first', async () => {
  const { rankMatchCandidates } = await import('../../.core-dist/lib/ingestion/match/resolve-match.js');
  const evidence = { date:'2026-08-28', opponentName:'Benedictine (KS)', homeAway:'neutral', setScores:['25-16','21-25','25-22','25-22'] };
  const candidates = [
    { id:'benedictine', date:'2026-08-28', opponentNames:['Benedictine College (Kan.)'], homeAway:'neutral' },
    { id:'other', date:'2026-08-29', opponentNames:['Grand View University'], homeAway:'neutral' },
  ];
  const ranked = rankMatchCandidates({evidence,candidates});
  assert.equal(ranked[0].candidate.id, 'benedictine');
  assert.equal(ranked[0].score, 0.5);
  assert.deepEqual(ranked[0].evidence, { sourceMatchId:false, date:true, opponent:false, homeAway:true, setScores:false });
  assert.deepEqual(resolveCanonicalMatch({evidence,candidates}), { status:'unmatched', confidence:0.5 });
});

test('a program-confirmed opponent alias makes the same Benedictine source auto-match on future imports', async () => {
  const evidence = { date:'2026-08-28', opponentName:'Benedictine (KS)', homeAway:'neutral' };
  const candidates = [
    { id:'benedictine', date:'2026-08-28', opponentNames:['Benedictine College (Kan.)','Benedictine (KS)'], homeAway:'neutral' },
  ];
  assert.deepEqual(resolveCanonicalMatch({evidence,candidates}), { status:'matched', matchId:'benedictine', confidence:0.85 });
});
