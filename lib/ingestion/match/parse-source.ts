import type { SourceFamily } from '../source-family.js';
import type { EvidenceObservation } from '../types.js';
import type { MatchEvidenceIdentity } from './resolve-match.js';
import { parsePublicBoxScoreHtml } from './public-boxscore.js';
import { parseStructuredXml } from './xml.js';
import { detectVbgameProducer } from './vbgame/producer.js';
import { parsePrestoVbgame } from './vbgame/presto.js';
import { parseLiveStatsVbgame } from './vbgame/livestats.js';
import type { ParsedTimelineDraft, VbgameProducer } from './timeline-types.js';

export type MatchSourceParseInput = {
  text: string;
  sourceFamily: SourceFamily;
  sourceUrl: string;
  ourTeamNames?: string[];
};

export type ParsedMatchSource = {
  match: MatchEvidenceIdentity;
  observations: EvidenceObservation[];
  sourceUrl: string;
  sourceFamily?: SourceFamily;
  producer?: VbgameProducer | 'public_sidearm';
  timeline?: ParsedTimelineDraft;
};

export function parseMatchSource(input: MatchSourceParseInput): ParsedMatchSource {
  if (input.sourceFamily === 'public_box_score') {
    return parsePublicBoxScoreHtml(input.text, input.sourceUrl, { ourTeamNames: input.ourTeamNames });
  }
  if (input.sourceFamily === 'official_xml') {
    const producer = detectVbgameProducer(input.text);
    if (producer === 'presto_vbgame') return parsePrestoVbgame(input.text, input.sourceUrl, input.ourTeamNames ?? []);
    if (producer === 'livestats_vbgame') return parseLiveStatsVbgame(input.text, input.sourceUrl, input.ourTeamNames ?? []);
    return parseStructuredXml(input.text, input.sourceFamily, input.sourceUrl);
  }
  if (input.sourceFamily === 'volleymetrics_xml') {
    return parseStructuredXml(input.text, input.sourceFamily, input.sourceUrl);
  }
  return { match: {}, observations: [], sourceUrl: input.sourceUrl };
}
