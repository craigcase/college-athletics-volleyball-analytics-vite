import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCoachQuestion } from '../../.core-dist/lib/coaches-edge/resolve.js';
import { executeAnalyticsQuery } from '../../.core-dist/lib/coaches-edge/execute.js';
import { formatCoachAnswer, unsupportedQuestionMessage } from '../../.core-dist/lib/coaches-edge/presentation.js';

const context={matchId:'match-1',opponentNames:['Mayville State University']};

test('resolver maps natural rally questions to deterministic rally metrics',()=>{
  const cases=[
    ['What was our sideout percentage against Mayville?','sideout_percentage'],
    ['How often did we score the first point after siding out?','score1_percentage'],
    ['How many SOS2 opportunities did we convert?','sos2_percentage'],
    ['How often did we win the first two serving rallies after sideout?','sos2_percentage'],
    ['How long were our best serving runs?','longest_service_run'],
    ['What was our point scored percentage?','point_scored_percentage'],
    ['What was our EPO percentage?','epo_percentage'],
  ];
  for(const [question,metric] of cases){
    const result=resolveCoachQuestion(question,context);
    assert.equal(result.status,'resolved',question);
    assert.equal(result.query.intent,'compare_metric',question);
    assert.equal(result.query.metric,metric,question);
    assert.deepEqual(result.query.subjects,['our_team'],question);
  }
});

test('contact-sequence questions refuse safely rather than falling through to hitting percentage',()=>{
  const result=resolveCoachQuestion('What was our T3 hitting percentage?',context);
  assert.equal(result.status,'unsupported');
  assert.equal(result.reasonCode,'requires_contact_sequence');
  assert.match(unsupportedQuestionMessage(result.reasonCode,{rotationState:false,contactSequence:false}),/contact sequence/i);
});

test('rally metric presentation includes numerator and opportunity denominator from stored evidence',()=>{
  const query={intent:'compare_metric',scope:{matchId:'match-1'},metric:'sideout_percentage',subjects:['our_team']};
  const evidence=[{matchId:'match-1',subject:'our_team',metric:'sideout_percentage',value:49/94,numerator:49,opportunities:94,engineVersion:'1.0.0'}];
  const answer=executeAnalyticsQuery(query,evidence);
  assert.equal(answer.status,'answered');
  assert.equal(formatCoachAnswer(query,answer.numbers,'Mayville State University',answer.evidence),'Our sideout percentage was 52.1% (49 of 94 opportunities).');
});

test('SOS2 presentation reports converted opportunities, not only the percentage',()=>{
  const query={intent:'compare_metric',scope:{matchId:'match-1'},metric:'sos2_percentage',subjects:['our_team']};
  const evidence=[{matchId:'match-1',subject:'our_team',metric:'sos2_percentage',value:13/47,numerator:13,opportunities:47,engineVersion:'1.0.0'}];
  const answer=executeAnalyticsQuery(query,evidence);
  assert.equal(answer.status,'answered');
  assert.equal(formatCoachAnswer(query,answer.numbers,'Mayville State University',answer.evidence),'We converted 13 of 47 SOS2 opportunities (27.7%).');
});
