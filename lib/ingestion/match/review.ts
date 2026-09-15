import type { MatchEvidenceIdentity, RankedMatchCandidate } from './resolve-match.js';

export type MatchReviewCandidate = {
  matchId: string;
  canonicalOpponentName: string;
  date?: string;
  homeAway?: string;
  setScores?: string[];
  result?: string;
  confidence: number;
  matchedEvidence: Array<'sourceMatchId'|'date'|'opponent'|'homeAway'|'setScores'>;
};

export type MatchReview = {
  sourceArtifactId: string;
  imported: MatchEvidenceIdentity;
  suggested?: MatchReviewCandidate;
  candidates: MatchReviewCandidate[];
};

export function buildMatchReview(input:{sourceArtifactId:string;evidence:MatchEvidenceIdentity;ranked:RankedMatchCandidate[]}):MatchReview{
  const candidates=input.ranked.slice(0,8).map(item=>({
    matchId:item.candidate.id,
    canonicalOpponentName:item.candidate.opponentNames[0] ?? 'Opponent',
    ...(item.candidate.date?{date:item.candidate.date}:{}),
    ...(item.candidate.homeAway?{homeAway:item.candidate.homeAway}:{}),
    ...(item.candidate.setScores?{setScores:item.candidate.setScores}:{}),
    ...(item.candidate.result?{result:item.candidate.result}:{}),
    confidence:item.score,
    matchedEvidence:(Object.entries(item.evidence) as Array<[keyof typeof item.evidence,boolean]>).filter(([,matched])=>matched).map(([key])=>key),
  }));
  return {sourceArtifactId:input.sourceArtifactId,imported:input.evidence,...(candidates[0]?{suggested:candidates[0]}:{}),candidates};
}
