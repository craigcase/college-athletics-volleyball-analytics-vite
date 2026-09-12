import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCapabilities } from '../../.core-dist/lib/capabilities/detect.js';

test('basic box score produces only provable basic capabilities', () => {
  const caps = detectCapabilities({
    observations: [
      { entityType: 'team', entityKey: 'us', field: 'kills', value: 40 },
      { entityType: 'team', entityKey: 'us', field: 'attack_errors', value: 15 },
      { entityType: 'team', entityKey: 'us', field: 'attack_attempts', value: 100 },
      { entityType: 'player', entityKey: 'p1', field: 'kills', value: 12 },
    ],
  });
  assert.equal(caps.boxScoreTotals, true);
  assert.equal(caps.playerTotals, true);
  assert.equal(caps.rallySequence, false);
  assert.equal(caps.contactQuality, false);
});

test('set evidence enables set totals without implying rally sequence', () => {
  const caps = detectCapabilities({ observations: [
    { entityType: 'team', entityKey: 'us', field: 'kills', value: 10, setNumber: 1 },
  ]});
  assert.equal(caps.setTotals, true);
  assert.equal(caps.rallySequence, false);
});
