import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRallyAnalytics } from '../../.core-dist/lib/analytics/rally.js';
import { buildServiceRuns } from '../../.core-dist/lib/analytics/service-runs.js';

const other = side => side === 'our_team' ? 'opponent' : 'our_team';
function rally(setNumber,rallyNumber,servingSide,pointWinner,extra={}){
  return {
    setNumber,rallyNumber,
    scoreBefore:{our:0,opponent:0},scoreAfter:{our:0,opponent:0},
    ...(servingSide?{servingSide,receivingSide:other(servingSide)}:{}),
    pointWinner,pathway:'unknown_phase',attribution:'unknown',evidenceStatus:'supported',sourceLinks:[],...extra,
  };
}
const metric=(rows,subject,code)=>rows.find(x=>x.subject===subject&&x.metric===code);

test('Sideout and Point Scored exclude unknown serve state and use receiving/serving outcomes exactly',()=>{
  const rallies=[
    rally(1,1,'opponent','our_team'),
    rally(1,2,'our_team','our_team'),
    rally(1,3,'our_team','opponent'),
    rally(1,4,'opponent','opponent'),
    rally(1,5,undefined,'our_team',{evidenceStatus:'gap_placeholder'}),
  ];
  const rows=calculateRallyAnalytics({matchId:'m',canonicalRevision:2,rallies});
  assert.deepEqual(metric(rows,'our_team','sideout_percentage'),{matchId:'m',subject:'our_team',metric:'sideout_percentage',numerator:1,denominator:2,value:.5,engineVersion:'1.0.0',canonicalRevision:2});
  assert.equal(metric(rows,'our_team','point_scored_percentage').numerator,1);
  assert.equal(metric(rows,'our_team','point_scored_percentage').denominator,2);
  assert.equal(metric(rows,'opponent','sideout_percentage').numerator,1);
  assert.equal(metric(rows,'opponent','sideout_percentage').denominator,2);
});

test('Score1 censors set-ending sideouts and scores the first serving rally after each eligible sideout',()=>{
  const rallies=[
    rally(1,1,'opponent','our_team'), // opp serve -> our sideout, eligible
    rally(1,2,'our_team','our_team'), // Score1 success
    rally(1,3,'our_team','opponent'),
    rally(1,4,'opponent','our_team'), // eligible
    rally(1,5,'our_team','opponent'), // failure
    rally(1,6,'opponent','our_team'), // set-ending trigger censored
  ];
  const rows=calculateRallyAnalytics({matchId:'m',canonicalRevision:1,rallies});
  const score1=metric(rows,'our_team','score1_percentage');
  assert.equal(score1.numerator,1);
  assert.equal(score1.denominator,2);
  assert.equal(score1.value,.5);
});

test('SOS2 requires two consecutive serving-rally wins after sideout and censors incomplete set-end opportunities',()=>{
  const rallies=[
    rally(1,1,'opponent','our_team'),
    rally(1,2,'our_team','our_team'),
    rally(1,3,'our_team','our_team'), // success
    rally(1,4,'our_team','opponent'),
    rally(1,5,'opponent','our_team'),
    rally(1,6,'our_team','our_team'),
    rally(1,7,'our_team','opponent'), // fail after first serving win
    rally(1,8,'opponent','our_team'),
    rally(1,9,'our_team','opponent'), // fail first serving rally
    rally(1,10,'opponent','our_team'),
    rally(1,11,'our_team','our_team'), // set ends after first serving win: censor
  ];
  const rows=calculateRallyAnalytics({matchId:'m',canonicalRevision:1,rallies});
  const sos2=metric(rows,'our_team','sos2_percentage');
  assert.equal(sos2.numerator,1);
  assert.equal(sos2.denominator,3);
  assert.equal(sos2.value,1/3);
});

test('EPO uses Given points as triggers, censors set-ending triggers, and excludes pressure-created/stuff blocks',()=>{
  const rallies=[
    rally(1,1,'opponent','our_team',{attribution:'given'}),
    rally(1,2,'our_team','our_team'), // success after Given
    rally(1,3,'our_team','our_team',{attribution:'pressure_created',terminal:{type:'stuff_block',rawText:'blocked'}}),
    rally(1,4,'our_team','opponent'), // not an EPO trial from pressure-created
    rally(1,5,'opponent','our_team',{attribution:'given'}),
    rally(1,6,'our_team','opponent'), // EPO fail
    rally(1,7,'opponent','our_team',{attribution:'given'}), // set ending trigger censored
  ];
  const rows=calculateRallyAnalytics({matchId:'m',canonicalRevision:1,rallies});
  const epo=metric(rows,'our_team','epo_percentage');
  assert.equal(epo.numerator,1);
  assert.equal(epo.denominator,2);
  assert.equal(epo.value,.5);
});

test('service runs retain serves and points separately and longest run uses points won',()=>{
  const rallies=[
    rally(1,1,'our_team','our_team',{serverSourceKey:'8'}),
    rally(1,2,'our_team','our_team',{serverSourceKey:'8'}),
    rally(1,3,'our_team','opponent',{serverSourceKey:'8'}),
    rally(1,4,'opponent','our_team',{serverSourceKey:'4'}),
    rally(1,5,'our_team','opponent',{serverSourceKey:'3'}),
  ];
  const runs=buildServiceRuns(rallies);
  assert.deepEqual(runs[0],{teamSide:'our_team',setNumber:1,startRallyNumber:1,endRallyNumber:3,pointsWon:2,serveAttempts:3,serverSourceKey:'8'});
  const rows=calculateRallyAnalytics({matchId:'m',canonicalRevision:1,rallies});
  assert.equal(metric(rows,'our_team','longest_service_run').value,2);
});


test('match-level rally analytics are withheld when an official set score conflicts with the source scoring sequence',()=>{
  const rallies=[
    rally(1,1,'opponent','our_team'),
    rally(1,2,'our_team','our_team'),
  ];
  const rows=calculateRallyAnalytics({
    matchId:'m',canonicalRevision:1,rallies,
    setScoreIntegrity:[{
      setNumber:1,
      officialFinalScore:{our:1,opponent:1},
      sourceFinalScore:{our:2,opponent:0},
      status:'conflict',
    }],
  });
  assert.deepEqual(rows,[]);
});
