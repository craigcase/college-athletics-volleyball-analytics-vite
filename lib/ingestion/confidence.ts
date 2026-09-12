import type { SourceFamily } from './source-family.js';

const RICH_FIELDS = new Set(['pass_quality','dig_quality','set_quality','attack_origin','attack_destination','on_court']);
const SEQUENCE_FIELDS = new Set(['score_after','serving_team','rotation','serve_receive_state']);

export function sourceConfidence(family: SourceFamily, field: string): number {
  if (family === 'unknown') return 0.2;
  if (RICH_FIELDS.has(field)) return family === 'volleymetrics_xml' ? 0.98 : family === 'official_xml' ? 0.55 : 0.25;
  if (SEQUENCE_FIELDS.has(field)) return family === 'volleymetrics_xml' ? 0.95 : family === 'official_xml' ? 0.9 : 0.35;
  if (family === 'volleymetrics_xml') return 0.92;
  if (family === 'official_xml') return 0.9;
  if (family === 'public_box_score') return 0.75;
  return 0.2;
}
