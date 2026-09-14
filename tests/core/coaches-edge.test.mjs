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
    ['How many kills did we have?', 'kills', ['our_team'], undefined],
    ['How many aces did Mayville have?', 'aces', ['opponent'], undefined],
    ['Who had more attack errors?', 'attack_errors', ['our_team', 'opponent'], 'more'],
    ['What were our attack attempts?', 'attack_attempts', ['our_team'], undefined],
    ['Compare our service errors to Mayville.', 'service_errors', ['our_team', 'opponent'], undefined],
    ['What was our hitting percentage?', 'hitting_percentage', ['our_team'], undefined],
  ];

  for (const [question, metric, subjects, comparison] of cases) {
    const result = resolveCoachQuestion(question, context);
    assert.equal(result.status, 'resolved', question);
    assert.deepEqual(result.query, {
      intent: 'compare_metric',
      scope: { matchId: 'match-1' },
      metric,
      subjects,
      ...(comparison ? { comparison } : {}),
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


test('resolver routes finding questions to deterministic stored findings', () => {
  assert.deepEqual(
    resolveCoachQuestion('Where did we have the biggest statistical edge against Mayville?', context),
    {
      status: 'resolved',
      query: { intent: 'top_finding', scope: { matchId: 'match-1' }, findingSide: 'our_team' }
    }
  );
  assert.deepEqual(
    resolveCoachQuestion("What was Mayville's strongest advantage?", context),
    {
      status: 'resolved',
      query: { intent: 'top_finding', scope: { matchId: 'match-1' }, findingSide: 'opponent' }
    }
  );
  assert.deepEqual(
    resolveCoachQuestion('What stood out in this match?', context),
    {
      status: 'resolved',
      query: { intent: 'top_finding', scope: { matchId: 'match-1' }, findingSide: 'either' }
    }
  );
});

test('finding executor returns the highest ranked stored finding for the requested side', () => {
  const result = executeAnalyticsQuery(
    { intent: 'top_finding', scope: { matchId: 'match-1' }, findingSide: 'our_team' },
    [
      { matchId: 'match-1', subject: 'our_team', metric: 'kills', value: 51, engineVersion: '1.0.0' },
      { matchId: 'match-1', subject: 'opponent', metric: 'kills', value: 46, engineVersion: '1.0.0' },
    ],
    [
      { matchId: 'match-1', side: 'our_team', metric: 'aces', direction: 'our_advantage', magnitude: 2, rankScore: 1.5, ourValue: 8, opponentValue: 6, engineVersion: '1.0.0' },
      { matchId: 'match-1', side: 'our_team', metric: 'kills', direction: 'our_advantage', magnitude: 5, rankScore: 3.75, ourValue: 51, opponentValue: 46, engineVersion: '1.0.0' },
      { matchId: 'match-1', side: 'opponent', metric: 'service_errors', direction: 'opponent_advantage', magnitude: 3, rankScore: 2.25, ourValue: 7, opponentValue: 4, engineVersion: '1.0.0' },
    ]
  );
  assert.equal(result.status, 'answered');
  assert.equal(result.finding?.metric, 'kills');
  assert.deepEqual(result.numbers, [51, 46]);
});

test('resolver recognizes natural tactical prescription phrasing', () => {
  for (const question of [
    'Who should we serve against Mayville?',
    'Where should we serve against Mayville?',
    'Who should we attack against Mayville?',
    'Who should we target?',
  ]) {
    const result = resolveCoachQuestion(question, context);
    assert.equal(result.status, 'unsupported', question);
    assert.equal(result.reasonCode, 'prescriptive', question);
  }
});

test('more and fewer comparison language is retained so presentation can answer the question directly', async () => {
  const more = resolveCoachQuestion('Who had more attack errors?', context);
  assert.equal(more.status, 'resolved');
  assert.equal(more.query.comparison, 'more');

  const presentation = await import('../../.core-dist/lib/coaches-edge/presentation.js');
  assert.equal(
    presentation.formatCoachAnswer(more.query, [25, 28], 'Mayville State University'),
    'Mayville State University had more attack errors, 28 to our 25.'
  );
});

test('finding presentation explains the promoted deterministic finding without inventing a conclusion', async () => {
  const presentation = await import('../../.core-dist/lib/coaches-edge/presentation.js');
  assert.equal(
    presentation.formatFindingAnswer(
      { matchId:'match-1', side:'our_team', metric:'kills', direction:'our_advantage', magnitude:5, rankScore:3.75, ourValue:51, opponentValue:46, engineVersion:'1.0.0' },
      'Mayville State University'
    ),
    'Our strongest promoted statistical edge was kills: 51 to 46, a 5-kill advantage.'
  );
});

test('named metric finding-strength question compares the metric gap with the promotion threshold', async()=>{
  const result=resolveCoachQuestion('Was our hitting percentage advantage one of the strongest findings?',context);
  assert.equal(result.status,'resolved');
  assert.equal(result.query.intent,'metric_finding_status');
  assert.equal(result.query.metric,'hitting_percentage');
  assert.deepEqual(result.query.subjects,['our_team','opponent']);
  const presentation=await import('../../.core-dist/lib/coaches-edge/presentation.js');
  assert.equal(
    presentation.formatCoachAnswer(result.query,[.153,.111],'Mayville State University',[
      {matchId:'match-1',subject:'our_team',metric:'hitting_percentage',value:.153,engineVersion:'1.0.0'},
      {matchId:'match-1',subject:'opponent',metric:'hitting_percentage',value:.111,engineVersion:'1.0.0'},
    ]),
    'We hit .153 to Mayville State University’s .111, a .042 advantage. That is below the .050 promotion threshold, so it was not one of the strongest promoted findings.'
  );
});
