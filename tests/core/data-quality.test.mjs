import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const baseRally = {
  setNumber:1,rallyNumber:1,scoreBefore:{our:0,opponent:0},scoreAfter:{our:1,opponent:0},
  servingSide:'opponent',receivingSide:'our_team',pointWinner:'our_team',pathway:'unknown_phase',attribution:'unknown',evidenceStatus:'gap_placeholder',sourceLinks:[],
};

test('active staff override overlays a canonical rally terminal without mutating the source-shaped input', async () => {
  const { applyRallyOverrides } = await import('../../.core-dist/lib/ingestion/reconciliation/overrides.js');
  const source = [{...baseRally}];
  const output = applyRallyOverrides(source,[{entityId:'match_1:1:1',fieldName:'terminal_event_type',value:'kill'}],'match_1');
  assert.equal(source[0].terminal, undefined);
  assert.equal(output[0].terminal?.type,'kill');
  assert.equal(output[0].terminal?.teamSide,'our_team');
  assert.equal(output[0].attribution,'earned');
  assert.equal(output[0].pathway,'unknown_phase');
});

test('correction validation requires explicit permission and accepts only guided fields/reasons', async () => {
  const { validateMatchCorrection } = await import('../../.core-dist/lib/ingestion/reconciliation/corrections.js');
  assert.throws(()=>validateMatchCorrection({canCorrectData:false,fieldName:'terminal_event_type',value:'kill',reason:null}),/DATA_CORRECTION_FORBIDDEN/);
  assert.deepEqual(validateMatchCorrection({canCorrectData:true,fieldName:'terminal_event_type',value:'kill',reason:'reviewed_film'}),{fieldName:'terminal_event_type',value:'kill',reason:'reviewed_film'});
  assert.throws(()=>validateMatchCorrection({canCorrectData:true,fieldName:'point_winner',value:'opponent',reason:null}),/CORRECTION_FIELD_NOT_ALLOWED/);
  assert.throws(()=>validateMatchCorrection({canCorrectData:true,fieldName:'terminal_event_type',value:'kill',reason:'because_i_said_so'}),/CORRECTION_REASON_NOT_ALLOWED/);
});

test('data quality endpoints expose read, correction, undo, audit history, and deterministic recalculation contracts', async () => {
  const repo = await readFile(new URL('../../db/repositories/data-quality.ts', import.meta.url),'utf8');
  const service = await readFile(new URL('../../lib/services/correct-match-data.ts', import.meta.url),'utf8');
  const readEndpoint = await readFile(new URL('../../netlify/functions/match-data-quality.ts', import.meta.url),'utf8');
  const correctionEndpoint = await readFile(new URL('../../netlify/functions/match-data-correction.ts', import.meta.url),'utf8');
  assert.match(repo,/canonical_override_history/);
  assert.match(repo,/canonical_overrides/);
  assert.match(repo,/reconciliation_issues/);
  assert.match(repo,/\.eq\('issue_type','unresolved_rally_detail'\)/);
  assert.match(repo,/export async function getMatchDataQuality/);
  assert.match(service,/export async function applyMatchCorrection/);
  assert.match(service,/export async function undoMatchCorrection/);
  assert.match(service,/recalculateMatch/);
  assert.match(readEndpoint,/getMatchDataQuality/);
  assert.match(correctionEndpoint,/applyMatchCorrection/);
  assert.match(correctionEndpoint,/undoMatchCorrection/);
});
