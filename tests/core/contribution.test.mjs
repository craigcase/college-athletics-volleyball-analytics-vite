import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateContribution } from '../../.core-dist/lib/analytics/contribution.js';

test('contribution uses the locked V1 weights exactly', () => {
  const result = calculateContribution({
    assistedKills: 2,
    unassistedKills: 1,
    attackErrors: 1,
    aces: 2,
    serviceErrors: 1,
    soloBlocks: 1,
    blockAssists: 2,
    settingErrors: 1,
    receptionErrors: 1,
    bhes: 1,
    directPointBlockingErrors: 1,
    digs: 3,
    fallbackPasses: 2,
  });
  assert.equal(result, 2 * 0.7 + 1 - 1 + 2 - 1 + 1 + 2 * 0.5 - 1 - 1 - 1 - 1 + 3 * 0.19 + 2 * 0.27);
});

test('contribution refuses to invent kill attribution when only total kills are known', () => {
  assert.equal(calculateContribution({ kills: 8, attackErrors: 2 }), null);
});
