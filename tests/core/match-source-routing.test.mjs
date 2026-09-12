import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMatchSource } from '../../.core-dist/lib/ingestion/match/parse-source.js';

test('match source router carries program team aliases into public box-score parsing', () => {
  const html=`<table><tr><th>Set</th><th colspan="4">VCSU</th><th colspan="4">Mayville State</th></tr><tr><td>Total</td><td>40</td><td>14</td><td>101</td><td>.257</td><td>31</td><td>20</td><td>103</td><td>.107</td></tr></table>`;
  const parsed=parseMatchSource({text:html,sourceFamily:'public_box_score',sourceUrl:'https://example.edu/boxscore/1',ourTeamNames:['VCSU','VIKINGS']});
  assert.equal(parsed.match.opponentName,'Mayville State');
  assert.equal(parsed.observations.find(o=>o.entityKey==='us'&&o.field==='kills')?.value,40);
});
