import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceConfidence } from '../../.core-dist/lib/ingestion/confidence.js';

test('source confidence is field-aware and does not treat derivative presentation as independent quality', () => {
  assert.ok(sourceConfidence('official_xml','score_after') > sourceConfidence('public_box_score','score_after'));
  assert.ok(sourceConfidence('volleymetrics_xml','attack_destination') > sourceConfidence('official_xml','attack_destination'));
  assert.ok(sourceConfidence('public_box_score','kills') > 0);
  assert.equal(sourceConfidence('unknown','kills'), 0.2);
});
