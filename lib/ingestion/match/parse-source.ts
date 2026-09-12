import type { SourceFamily } from '../source-family.js';
import type { EvidenceObservation } from '../types.js';
import type { MatchEvidenceIdentity } from './resolve-match.js';
import { parsePublicBoxScoreHtml } from './public-boxscore.js';
import { parseStructuredXml } from './xml.js';

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
};

export function parseMatchSource(input: MatchSourceParseInput): ParsedMatchSource {
  if (input.sourceFamily === 'public_box_score') {
    return parsePublicBoxScoreHtml(input.text, input.sourceUrl, { ourTeamNames: input.ourTeamNames });
  }
  if (input.sourceFamily === 'official_xml' || input.sourceFamily === 'volleymetrics_xml') {
    return parseStructuredXml(input.text, input.sourceFamily, input.sourceUrl);
  }
  return { match: {}, observations: [], sourceUrl: input.sourceUrl };
}
