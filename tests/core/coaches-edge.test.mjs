import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCoachQuestion } from '../../.core-dist/lib/coaches-edge/resolve.js';
import { executeAnalyticsQuery } from '../../.core-dist/lib/coaches-edge/execute.js';

test('natural language becomes a structured hitting-percentage comparison query', () => {
  const result = resolveCoachQuestion('How did we hit against Mayville?', {
    matchId: 'match-1', opponentNames: ['Mayville','Mayville State']
  });
  assert.deepEqual(result, {
    status: 'resolved',
    query: { intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'hitting_percentage', subjects: ['our_team','opponent'] }
  });
});

test('executor only returns numbers present in the deterministic evidence package', () => {
  const result = executeAnalyticsQuery(
    { intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'hitting_percentage', subjects: ['our_team','opponent'] },
    [
      { matchId: 'match-1', subject: 'our_team', metric: 'hitting_percentage', value: 0.278, opportunities: 97, engineVersion: '1.0.0' },
      { matchId: 'match-1', subject: 'opponent', metric: 'hitting_percentage', value: 0.194, opportunities: 103, engineVersion: '1.0.0' },
    ]
  );
  assert.equal(result.status, 'answered');
  assert.deepEqual(result.numbers, [0.278, 0.194]);
  assert.equal(result.scope.matchId, 'match-1');
});

test('unsupported question does not fabricate a query', () => {
  const result = resolveCoachQuestion('Who should we start tomorrow?', { matchId: 'match-1', opponentNames: [] });
  assert.equal(result.status, 'unsupported');
});
