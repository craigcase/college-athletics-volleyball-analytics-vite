import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCapabilities } from '../../.core-dist/lib/capabilities/detect.js';

test('basic box score produces only provable basic capabilities', () => {
  const caps = detectCapabilities({ evidence: {
    observations: [
      { entityType: 'team', entityKey: 'us', field: 'kills', value: 40 },
      { entityType: 'team', entityKey: 'us', field: 'attack_errors', value: 15 },
      { entityType: 'team', entityKey: 'us', field: 'attack_attempts', value: 100 },
      { entityType: 'player', entityKey: 'p1', field: 'kills', value: 12 },
    ],
  }});
  assert.equal(caps.boxScoreTotals, true);
  assert.equal(caps.playerTotals, true);
  assert.equal(caps.rallySequence, false);
  assert.equal(caps.contactQuality, false);
  assert.equal(caps.terminalEventDetail, false);
  assert.equal(caps.timeoutTimeline, false);
  assert.equal(caps.transitionDepth, false);
});

test('set evidence enables set totals without implying rally sequence', () => {
  const caps = detectCapabilities({ evidence: { observations: [
    { entityType: 'team', entityKey: 'us', field: 'kills', value: 10, setNumber: 1 },
  ]}});
  assert.equal(caps.setTotals, true);
  assert.equal(caps.rallySequence, false);
});

test('canonical rally facts unlock exact sequence capabilities without inventing contacts or transition depth', () => {
  const caps = detectCapabilities({
    evidence: { observations: [] },
    rallyFacts: {
      rallyCount: 195,
      knownServeStateCount: 193,
      terminalDetailCount: 193,
      timeoutCount: 8,
      substitutionCount: 0,
      phaseCount: 0,
      transitionDepthCount: 0,
      contactCount: 0,
      timestampCount: 0,
    },
  });
  assert.equal(caps.rallySequence, true);
  assert.equal(caps.serveReceiveState, true);
  assert.equal(caps.terminalEventDetail, true);
  assert.equal(caps.timeoutTimeline, true);
  assert.equal(caps.substitutionTimeline, false);
  assert.equal(caps.offensivePhase, false);
  assert.equal(caps.transitionDepth, false);
  assert.equal(caps.contactSequence, false);
  assert.equal(caps.contactQuality, false);
  assert.equal(caps.timestamps, false);
});
