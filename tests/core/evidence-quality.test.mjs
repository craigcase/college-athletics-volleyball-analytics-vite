import test from 'node:test';
import assert from 'node:assert/strict';

const makeTimeline = () => ({
  rallies: [
    {
      setNumber: 1, rallyNumber: 1,
      scoreBefore: { our: 0, opponent: 0 }, scoreAfter: { our: 1, opponent: 0 },
      servingSide: 'opponent', receivingSide: 'our_team', pointWinner: 'our_team',
      pathway: 'unknown_phase', attribution: 'unknown', evidenceStatus: 'gap_placeholder', sourceLinks: [],
    },
  ],
  timelineEvents: [],
  setScoreIntegrity: [{setNumber:1,officialFinalScore:{our:1,opponent:0},sourceFinalScore:{our:1,opponent:0},status:'verified'}],
});

test('evidence audit uniquely reconciles a missing kill only when box-score constraints leave one solution', async () => {
  const { auditTimelineAgainstTotals } = await import('../../.core-dist/lib/ingestion/reconciliation/audit.js');
  const result = auditTimelineAgainstTotals({
    timeline: makeTimeline(),
    observations: [
      {entityType:'team',entityKey:'us',field:'kills',value:1},
      {entityType:'team',entityKey:'us',field:'aces',value:0},
      {entityType:'team',entityKey:'opponent',field:'service_errors',value:0},
      {entityType:'team',entityKey:'opponent',field:'attack_errors',value:0},
      {entityType:'player',entityKey:'us:player:Brynn Sorenson',field:'kills',value:1},
      {entityType:'player',entityKey:'us:player:Mady Geist',field:'kills',value:0},
    ],
  });
  assert.equal(result.reconciledCount, 1);
  assert.equal(result.unresolvedCount, 0);
  assert.equal(result.timeline.rallies[0].evidenceStatus, 'uniquely_reconciled');
  assert.equal(result.timeline.rallies[0].terminal?.type, 'kill');
  assert.equal(result.timeline.rallies[0].terminal?.playerSourceKey, 'Brynn Sorenson');
  assert.equal(result.timeline.rallies[0].attribution, 'earned');
  assert.equal(result.findings[0].status, 'uniquely_reconciled');
});

test('evidence audit leaves a missing point unresolved when two terminal explanations fit the totals', async () => {
  const { auditTimelineAgainstTotals } = await import('../../.core-dist/lib/ingestion/reconciliation/audit.js');
  const result = auditTimelineAgainstTotals({
    timeline: makeTimeline(),
    observations: [
      {entityType:'team',entityKey:'us',field:'kills',value:0},
      {entityType:'team',entityKey:'us',field:'aces',value:0},
      {entityType:'team',entityKey:'opponent',field:'service_errors',value:0},
      {entityType:'team',entityKey:'opponent',field:'attack_errors',value:1},
    ],
  });
  assert.equal(result.reconciledCount, 0);
  assert.equal(result.unresolvedCount, 1);
  assert.equal(result.timeline.rallies[0].evidenceStatus, 'gap_placeholder');
  assert.equal(result.timeline.rallies[0].terminal, undefined);
  assert.equal(result.findings[0].status, 'unresolved');
  assert.ok(result.findings[0].possibleTerminalTypes.includes('attack_error'));
  assert.ok(result.findings[0].possibleTerminalTypes.includes('stuff_block'));
});

test('import quality summary reports reconciled and unresolved rally detail without treating it as match identity failure', async () => {
  const { buildImportQualitySummary } = await import('../../.core-dist/lib/ingestion/reconciliation/quality.js');
  const timeline = makeTimeline();
  timeline.rallies.push({
    ...timeline.rallies[0], rallyNumber:2,
    scoreBefore:{our:1,opponent:0},scoreAfter:{our:1,opponent:1},pointWinner:'opponent',
    evidenceStatus:'uniquely_reconciled',terminal:{type:'kill',teamSide:'opponent',rawText:'Reconciled from official totals'},attribution:'earned',
  });
  const summary = buildImportQualitySummary({sourceFamily:'official_xml',producer:'presto_vbgame',timeline});
  assert.equal(summary.dataLevel, 'Standard');
  assert.equal(summary.rallyCount, 2);
  assert.equal(summary.reconciledCount, 1);
  assert.equal(summary.unresolvedCount, 1);
  assert.equal(summary.structuralConflictCount, 0);
});
