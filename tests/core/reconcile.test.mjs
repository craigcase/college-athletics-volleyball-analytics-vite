import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileField } from '../../.core-dist/lib/ingestion/reconcile.js';

test('staff override is canonical and sticky over imports', () => {
  const result = reconcileField({
    override: { value: 42, note: 'verified from scorebook' },
    observations: [
      { value: 40, sourceConfidence: 0.9, lineageId: 'official-feed' },
      { value: 41, sourceConfidence: 0.8, lineageId: 'vm' },
    ],
  });
  assert.deepEqual(result, { status: 'resolved', value: 42, basis: 'staff_override' });
});

test('independent lineage agreement breaks an equal-confidence tie', () => {
  const result = reconcileField({ observations: [
    { value: 40, sourceConfidence: 0.9, lineageId: 'official-a' },
    { value: 40, sourceConfidence: 0.9, lineageId: 'independent-b' },
    { value: 41, sourceConfidence: 0.9, lineageId: 'other-c' },
  ]});
  assert.deepEqual(result, { status: 'resolved', value: 40, basis: 'source_confidence_and_independent_agreement' });
});
