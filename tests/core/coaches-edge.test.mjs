import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCoachQuestion } from '../../.core-dist/lib/coaches-edge/resolve.js';
import { executeAnalyticsQuery } from '../../.core-dist/lib/coaches-edge/execute.js';

const context = {
  matchId: 'match-1',
  opponentNames: ['Mayville State University'],
};

test('natural language becomes a structured hitting-percentage comparison query', () => {
  const result = resolveCoachQuestion('How did we hit against Mayville?', context);
  assert.deepEqual(result, {
    status: 'resolved',
    query: { intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'hitting_percentage', subjects: ['our_team','opponent'] }
  });
});

test('resolver supports the six implemented deterministic match metrics with natural subjects', () => {
  const cases = [
    ['How many kills did we have?', 'kills', ['our_team']],
    ['How many aces did Mayville have?', 'aces', ['opponent']],
    ['Who had more attack errors?', 'attack_errors', ['our_team', 'opponent']],
    ['What were our attack attempts?', 'attack_attempts', ['our_team']],
    ['Compare our service errors to Mayville.', 'service_errors', ['our_team', 'opponent']],
    ['What was our hitting percentage?', 'hitting_percentage', ['our_team']],
  ];

  for (const [question, metric, subjects] of cases) {
    const result = resolveCoachQuestion(question, context);
    assert.equal(result.status, 'resolved', question);
    assert.deepEqual(result.query, {
      intent: 'compare_metric',
      scope: { matchId: 'match-1' },
      metric,
      subjects,
    }, question);
  }
});

test('executor returns only the requested stored subject metric', () => {
  const result = executeAnalyticsQuery(
    { intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'kills', subjects: ['our_team'] },
    [
      { matchId: 'match-1', subject: 'our_team', metric: 'kills', value: 51, engineVersion: '1.0.0' },
      { matchId: 'match-1', subject: 'opponent', metric: 'kills', value: 46, engineVersion: '1.0.0' },
    ]
  );
  assert.equal(result.status, 'answered');
  assert.deepEqual(result.numbers, [51]);
  assert.deepEqual(result.evidence.map(item => item.subject), ['our_team']);
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

test('executor refuses a comparison when one requested deterministic metric is missing', () => {
  const result = executeAnalyticsQuery(
    { intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'aces', subjects: ['our_team','opponent'] },
    [
      { matchId: 'match-1', subject: 'our_team', metric: 'aces', value: 7, engineVersion: '1.0.0' },
    ]
  );
  assert.equal(result.status, 'insufficient_evidence');
  assert.deepEqual(result.numbers, []);
});

test('resolver distinguishes prescriptive, rotation-evidence, and unsupported query boundaries', () => {
  assert.deepEqual(
    resolveCoachQuestion('Who should we start tomorrow?', context),
    {
      status: 'unsupported',
      reasonCode: 'prescriptive',
      reason: 'Coach’s Edge explains evidence but does not make personnel or tactical prescriptions.',
    }
  );
  assert.deepEqual(
    resolveCoachQuestion('Which rotation was our weakest?', context),
    {
      status: 'unsupported',
      reasonCode: 'requires_rotation',
      reason: 'rotation',
    }
  );
  assert.deepEqual(
    resolveCoachQuestion('Tell me something interesting.', context),
    {
      status: 'unsupported',
      reasonCode: 'unsupported_query',
      reason: 'Coach’s Edge does not support that question type yet.',
    }
  );
});

test('presentation uses volleyball notation and evidence-aware coach-facing language', async () => {
  const presentation = await import('../../.core-dist/lib/coaches-edge/presentation.js').catch(() => null);
  assert.ok(presentation, 'Coach Edge presentation module should exist');

  assert.equal(presentation.formatMetricValue('hitting_percentage', 0.153), '.153');
  assert.equal(presentation.formatMetricValue('kills', 51), '51');

  assert.equal(
    presentation.formatCoachAnswer(
      { intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'hitting_percentage', subjects: ['our_team','opponent'] },
      [0.153, 0.111],
      'Mayville State University'
    ),
    'We hit .153; Mayville State University hit .111.'
  );
  assert.equal(
    presentation.formatCoachAnswer(
      { intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'kills', subjects: ['our_team'] },
      [51],
      'Mayville State University'
    ),
    'We had 51 kills.'
  );
  assert.equal(
    presentation.formatCoachAnswer(
      { intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'aces', subjects: ['opponent'] },
      [6],
      'Mayville State University'
    ),
    'Mayville State University had 6 aces.'
  );

  assert.equal(
    presentation.unsupportedQuestionMessage('requires_rotation', { rotationState: false }),
    'The current evidence doesn’t include rotation-by-rotation data, so I can’t answer that question for this match.'
  );
  assert.equal(
    presentation.unsupportedQuestionMessage('requires_rotation', { rotationState: true }),
    'This match has rotation-by-rotation evidence, but Coach’s Edge does not support rotation questions yet.'
  );
  assert.equal(
    presentation.insufficientEvidenceMessage({ intent: 'compare_metric', scope: { matchId: 'match-1' }, metric: 'aces', subjects: ['our_team','opponent'] }),
    'The current evidence doesn’t include enough ace data to answer that question.'
  );
});
