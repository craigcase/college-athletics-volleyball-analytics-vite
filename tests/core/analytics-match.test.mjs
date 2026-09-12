import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatchAnalytics } from '../../.core-dist/lib/analytics/match.js';
import { rankMatchFindings } from '../../.core-dist/lib/analytics/findings.js';

test('match analytics calculates only metrics supported by canonical evidence', () => {
  const result = calculateMatchAnalytics({
    matchId: 'm1', canonicalRevision: 3, capabilities: { boxScoreTotals: true },
    teams: {
      our_team: { kills: 45, attackErrors: 18, attackAttempts: 110, aces: 7, serviceErrors: 9 },
      opponent: { kills: 39, attackErrors: 22, attackAttempts: 115, aces: 4, serviceErrors: 7 }
    }
  });
  const ourHit = result.find(x => x.subject === 'our_team' && x.metric === 'hitting_percentage');
  assert.deepEqual(ourHit, {
    matchId: 'm1', subject: 'our_team', metric: 'hitting_percentage', numerator: 27,
    denominator: 110, value: 27/110, engineVersion: '1.0.0', canonicalRevision: 3
  });
  assert.equal(result.some(x => x.metric === 'sideout_percentage'), false);
});

test('unsupported box-score capability yields no fabricated metrics', () => {
  assert.deepEqual(calculateMatchAnalytics({ matchId:'m1', canonicalRevision:1, capabilities:{ boxScoreTotals:false }, teams:{} }), []);
});

test('finding ranker can return fewer than five rather than filling weak slots', () => {
  const findings = rankMatchFindings([
    { matchId:'m1', subject:'our_team', metric:'hitting_percentage', value:.31, denominator:100, numerator:31, engineVersion:'1.0.0', canonicalRevision:1 },
    { matchId:'m1', subject:'opponent', metric:'hitting_percentage', value:.14, denominator:100, numerator:14, engineVersion:'1.0.0', canonicalRevision:1 },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].metric, 'hitting_percentage');
  assert.equal(findings[0].direction, 'our_advantage');
});
