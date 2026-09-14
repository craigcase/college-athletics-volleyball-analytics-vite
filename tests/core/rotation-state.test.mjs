import test from 'node:test';
import assert from 'node:assert/strict';

function rally(n, servingSide, serverSourceKey, pointWinner = servingSide ?? 'our_team', evidenceStatus = 'supported') {
  return {
    setNumber: 1, rallyNumber: n,
    scoreBefore: { our: n - 1, opponent: 0 }, scoreAfter: { our: n, opponent: 0 },
    ...(servingSide ? { servingSide, receivingSide: servingSide === 'our_team' ? 'opponent' : 'our_team' } : {}),
    ...(serverSourceKey ? { serverSourceKey } : {}),
    pointWinner, pathway: 'unknown_phase', attribution: 'unknown', evidenceStatus, sourceLinks: [],
  };
}

test('serving cycle learns six slots and a known server re-anchors after a gap', async () => {
  const { deriveServingCycle } = await import('../../.core-dist/lib/ingestion/match/rotation-state.js');
  const ourServers = ['#8','#3','#12','#5','#9','#1'];
  const rallies = [];
  let n = 1;
  for (const server of ourServers) {
    rallies.push(rally(n++, 'our_team', server));
    rallies.push(rally(n++, 'opponent', `opp-${server}`));
  }
  rallies.push(rally(n++, undefined, undefined, 'our_team', 'gap_placeholder'));
  rallies.push(rally(n++, 'our_team', '#5'));
  const obs = deriveServingCycle(rallies);
  const firstSeen = new Map();
  for (const row of obs.filter(x => x.teamSide === 'our_team' && x.serverSourceKey && !firstSeen.has(x.serverSourceKey))) firstSeen.set(row.serverSourceKey, row.cycleSlot);
  assert.deepEqual([...firstSeen.entries()].slice(0,6), [['#8',1],['#3',2],['#12',3],['#5',4],['#9',5],['#1',6]]);
  const reanchor = obs.filter(x => x.serverSourceKey === '#5').at(-1);
  assert.equal(reanchor.cycleSlot, 4);
  assert.equal(reanchor.method, 'rule_derived');
});

test('new serving specialist inherits the expected existing cycle slot rather than creating a seventh slot', async () => {
  const { deriveServingCycle } = await import('../../.core-dist/lib/ingestion/match/rotation-state.js');
  const seq = ['#8','#3','#12','#5','#9','#1','#8','#4'];
  const rallies = [];
  let n = 1;
  for (const server of seq) {
    rallies.push(rally(n++, 'our_team', server));
    rallies.push(rally(n++, 'opponent', `opp-${n}`));
  }
  const obs = deriveServingCycle(rallies).filter(x => x.teamSide === 'our_team');
  const specialist = obs.find(x => x.serverSourceKey === '#4');
  assert.equal(specialist.cycleSlot, 2);
});

test('serving-cycle evidence never invents R1-R6 without an anchor', async () => {
  const { deriveServingCycle } = await import('../../.core-dist/lib/ingestion/match/rotation-state.js');
  const obs = deriveServingCycle([rally(1,'our_team','#8'), rally(2,'opponent','opp-1'), rally(3,'our_team','#3')]);
  assert.ok(obs.length > 0);
  assert.equal(obs.every(x => x.rotationNumber === undefined), true);
});
