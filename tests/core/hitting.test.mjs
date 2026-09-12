import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHittingPercentage } from '../../.core-dist/lib/analytics/hitting.js';

test('hitting percentage is deterministic from kills errors and attempts', () => {
  assert.equal(calculateHittingPercentage({ kills: 12, errors: 4, attempts: 32 }), 0.25);
});

test('hitting percentage is unknown with zero attempts', () => {
  assert.equal(calculateHittingPercentage({ kills: 0, errors: 0, attempts: 0 }), null);
});
