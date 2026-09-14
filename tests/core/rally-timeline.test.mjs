import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sideoutDraft = {
  producer: 'presto_vbgame',
  setFinalScores: [{ setNumber: 1, score: { our: 2, opponent: 2 } }],
  scoringRecords: [
    { setNumber:1, sourceKey:'1', sourceOrdinal:1, servingSide:'opponent', pointWinner:'our_team', scoreAfter:{our:1,opponent:0}, rawText:'[X] Service error.', terminal:{type:'service_error',teamSide:'opponent',rawText:'[X] Service error.'}},
    { setNumber:1, sourceKey:'2', sourceOrdinal:2, servingSide:'our_team', pointWinner:'our_team', scoreAfter:{our:2,opponent:0}, rawText:'[Y] Service ace.', terminal:{type:'service_ace',teamSide:'our_team',rawText:'[Y] Service ace.'}},
    { setNumber:1, sourceKey:'3', sourceOrdinal:3, servingSide:'our_team', pointWinner:'opponent', scoreAfter:{our:2,opponent:1}, rawText:'Kill by Opp', terminal:{type:'kill',teamSide:'opponent',rawText:'Kill by Opp'}},
    { setNumber:1, sourceKey:'4', sourceOrdinal:4, servingSide:'opponent', pointWinner:'opponent', scoreAfter:{our:2,opponent:2}, rawText:'Kill by Opp', terminal:{type:'kill',teamSide:'opponent',rawText:'Kill by Opp'}},
  ],
  timelineEvents: [],
};

test('canonical builder classifies only pathways supported by ordinary PBP', async () => {
  const { buildCanonicalTimeline } = await import('../../.core-dist/lib/ingestion/match/timeline-builder.js');
  const result = buildCanonicalTimeline(sideoutDraft);
  assert.equal(result.rallies[0].pathway, 'first_ball_sideout');
  assert.equal(result.rallies[0].attribution, 'given');
  assert.equal(result.rallies[1].pathway, 'direct_serve_point');
  assert.equal(result.rallies[1].attribution, 'earned');
  assert.equal(result.rallies[2].pathway, 'unknown_phase');
  assert.equal(result.rallies[3].pathway, 'transition_point');
});

test('Mayville missing scoring records become two local placeholders with rule-derived serve side but no fabricated player or terminal detail', async () => {
  const { parseLiveStatsVbgame } = await import('../../.core-dist/lib/ingestion/match/vbgame/livestats.js');
  const { buildCanonicalTimeline } = await import('../../.core-dist/lib/ingestion/match/timeline-builder.js');
  const xml = await readFile('tests/fixtures/v070/vcsu/09-2-26MayvilleGame.xml','utf8');
  const parsed = parseLiveStatsVbgame(xml, 'upload://mayville.xml', ['Valley City State','Valley City','VC','VCSU']);
  const canonical = buildCanonicalTimeline(parsed.timeline);
  assert.equal(canonical.rallies.length, 195);
  const gaps = canonical.rallies.filter(r => r.evidenceStatus === 'gap_placeholder');
  assert.equal(gaps.length, 2);
  for (const gap of gaps) {
    assert.equal(gap.terminal, undefined);
    assert.equal(gap.serverSourceKey, undefined);
    assert.equal(gap.servingSide, 'our_team');
    assert.equal(gap.receivingSide, 'opponent');
    assert.equal(gap.pathway, 'unknown_phase');
    assert.equal(gap.attribution, 'unknown');
  }
});

test('College of Saint Mary gap stays local and later supported rallies recover', async () => {
  const { parsePrestoVbgame } = await import('../../.core-dist/lib/ingestion/match/vbgame/presto.js');
  const { buildCanonicalTimeline } = await import('../../.core-dist/lib/ingestion/match/timeline-builder.js');
  const xml = await readFile('tests/fixtures/v070/vcsu/08-21-26CSMGame.xml','utf8');
  const parsed = parsePrestoVbgame(xml, 'upload://csm.xml', ['Valley City State','VCSU','VCS']);
  const canonical = buildCanonicalTimeline(parsed.timeline);
  const set3 = canonical.rallies.filter(r => r.setNumber === 3);
  assert.equal(set3.filter(r => r.evidenceStatus === 'gap_placeholder').length, 1);
  const gapIndex = set3.findIndex(r => r.evidenceStatus === 'gap_placeholder');
  assert.ok(gapIndex >= 0);
  assert.equal(set3[gapIndex + 1].evidenceStatus, 'supported');
  assert.equal(set3.at(-1).scoreAfter.our, 14);
  assert.equal(set3.at(-1).scoreAfter.opponent, 25);
});


test('rule-derived serving side corrects a source server-team contradiction and drops the unsupported server identity', async () => {
  const { buildCanonicalTimeline } = await import('../../.core-dist/lib/ingestion/match/timeline-builder.js');
  const draft = {
    producer:'presto_vbgame',
    setFinalScores:[{setNumber:1,score:{our:1,opponent:2}}],
    scoringRecords:[
      {setNumber:1,sourceKey:'1',sourceOrdinal:1,servingSide:'our_team',serverSourceKey:'our-8',pointWinner:'opponent',scoreAfter:{our:0,opponent:1},rawText:'Kill by Opp'},
      {setNumber:1,sourceKey:'2',sourceOrdinal:2,servingSide:'our_team',serverSourceKey:'our-8',pointWinner:'our_team',scoreAfter:{our:1,opponent:1},rawText:'Kill by Us'},
      {setNumber:1,sourceKey:'3',sourceOrdinal:3,servingSide:'our_team',serverSourceKey:'our-3',pointWinner:'opponent',scoreAfter:{our:1,opponent:2},rawText:'Kill by Opp'},
    ],
    timelineEvents:[],
  };
  const result=buildCanonicalTimeline(draft);
  assert.equal(result.rallies[0].servingSide,'our_team');
  assert.equal(result.rallies[1].servingSide,'opponent');
  assert.equal(result.rallies[1].receivingSide,'our_team');
  assert.equal(result.rallies[1].serverSourceKey,undefined);
  assert.equal(result.rallies[2].servingSide,'our_team');
});
