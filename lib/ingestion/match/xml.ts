import type { EvidenceObservation } from '../types.js';
import type { SourceFamily } from '../source-family.js';

type StructuredXmlEvidence = {
  match: { date?: string; opponentName?: string; homeAway?: 'home'|'away'|'neutral'|'unknown' };
  observations: EvidenceObservation[];
  sourceUrl: string;
  sourceFamily: SourceFamily;
};

function attrs(tag: string): Record<string,string> {
  const out: Record<string,string> = {};
  for (const m of tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)) out[m[1].toLowerCase()] = m[2];
  return out;
}
function numeric(v?: string): number|undefined { const n = v === undefined || v === '' ? NaN : Number(v); return Number.isFinite(n) ? n : undefined; }
function allowedSide(v?: string): 'home'|'away'|'neutral'|'unknown'|undefined { return v === 'home'||v === 'away'||v === 'neutral'||v === 'unknown' ? v : undefined; }

export function parseStructuredXml(xml: string, sourceFamily: SourceFamily, sourceUrl: string): StructuredXmlEvidence {
  const observations: EvidenceObservation[] = [];
  const matchTag = xml.match(/<match\b[^>]*>/i)?.[0];
  const ma = matchTag ? attrs(matchTag) : {};
  const match: StructuredXmlEvidence['match'] = {};
  if (ma.date) match.date = ma.date;
  if (ma.opponent) match.opponentName = ma.opponent;
  const ha = allowedSide(ma.homeaway);
  if (ha) match.homeAway = ha;

  const teamMap: Record<string,string> = { kills:'kills', errors:'attack_errors', attempts:'attack_attempts', aces:'aces', serviceerrors:'service_errors', assists:'assists', digs:'digs', blocks:'blocks', receptionerrors:'reception_errors' };
  for (const m of xml.matchAll(/<team\b[^>]*\/?\s*>/gi)) {
    const a = attrs(m[0]);
    if (a.side !== 'us' && a.side !== 'opponent') continue;
    for (const [attr, field] of Object.entries(teamMap)) {
      const value = numeric(a[attr]);
      if (value !== undefined) observations.push({ entityType:'team', entityKey:a.side, field, value });
    }
  }

  for (const m of xml.matchAll(/<rally\b[^>]*\/?\s*>/gi)) {
    const a = attrs(m[0]);
    const index = numeric(a.index);
    const entityKey = index === undefined ? 'rally' : `rally-${index}`;
    if (a.servingteam) observations.push({ entityType:'rally', entityKey, field:'serving_team', value:a.servingteam, ...(index !== undefined ? { rallyIndex:index } : {}) });
    if (a.scoreafter) observations.push({ entityType:'rally', entityKey, field:'score_after', value:a.scoreafter, ...(index !== undefined ? { rallyIndex:index } : {}) });
    if (a.rotation) observations.push({ entityType:'rally', entityKey, field:'rotation', value:a.rotation, ...(index !== undefined ? { rallyIndex:index } : {}) });
  }

  for (const m of xml.matchAll(/<contact\b[^>]*\/?\s*>/gi)) {
    const a = attrs(m[0]);
    const entityKey = a.player ?? 'unknown-player';
    if (a.passquality) observations.push({ entityType:'player', entityKey, field:'pass_quality', value:a.passquality });
    if (a.digquality) observations.push({ entityType:'player', entityKey, field:'dig_quality', value:a.digquality });
    if (a.setquality) observations.push({ entityType:'player', entityKey, field:'set_quality', value:a.setquality });
    if (a.attackorigin) observations.push({ entityType:'player', entityKey, field:'attack_origin', value:a.attackorigin });
    if (a.attackdestination) observations.push({ entityType:'player', entityKey, field:'attack_destination', value:a.attackdestination });
  }
  return { match, observations, sourceUrl, sourceFamily };
}
