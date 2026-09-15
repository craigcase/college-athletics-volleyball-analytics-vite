export type MatchEvidenceIdentity = {
  date?: string;
  opponentName?: string;
  homeAway?: 'home' | 'away' | 'neutral' | 'unknown';
  setScores?: string[];
  sourceMatchId?: string;
  result?: string;
};

export type MatchCandidate = {
  id: string;
  date?: string;
  opponentNames: string[];
  homeAway?: 'home' | 'away' | 'neutral' | 'unknown';
  setScores?: string[];
  sourceMatchIds?: string[];
  result?: string;
  opponentTeamId?: string;
};

export type MatchEvidenceBreakdown = {
  sourceMatchId: boolean;
  date: boolean;
  opponent: boolean;
  homeAway: boolean;
  setScores: boolean;
};

export type RankedMatchCandidate = {
  candidate: MatchCandidate;
  score: number;
  evidence: MatchEvidenceBreakdown;
};

export type MatchResolution =
  | { status: 'matched'; matchId: string; confidence: number }
  | { status: 'ambiguous'; candidateIds: string[]; confidence: number }
  | { status: 'unmatched'; confidence: number };

const normalize = (value: string | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizeOpponent = (value: string | undefined) => normalize(value).replace(/\s+(university|college)$/,'').trim();
const scoreSets = (a?: string[], b?: string[]) => !!a && !!b && a.length === b.length && a.every((v, i) => normalize(v) === normalize(b[i]));

function scoreCandidate(evidence: MatchEvidenceIdentity, candidate: MatchCandidate): RankedMatchCandidate {
  const breakdown: MatchEvidenceBreakdown = {
    sourceMatchId: Boolean(evidence.sourceMatchId && candidate.sourceMatchIds?.includes(evidence.sourceMatchId)),
    date: Boolean(evidence.date && candidate.date && evidence.date === candidate.date),
    opponent: Boolean(evidence.opponentName && candidate.opponentNames.some((name) => normalizeOpponent(name) === normalizeOpponent(evidence.opponentName))),
    homeAway: Boolean(evidence.homeAway && candidate.homeAway && evidence.homeAway !== 'unknown' && candidate.homeAway !== 'unknown' && evidence.homeAway === candidate.homeAway),
    setScores: scoreSets(evidence.setScores, candidate.setScores),
  };
  if (breakdown.sourceMatchId) return { candidate, score: 1, evidence: breakdown };
  let score = 0;
  if (breakdown.date) score += 0.35;
  if (breakdown.opponent) score += 0.35;
  if (breakdown.homeAway) score += 0.15;
  if (breakdown.setScores) score += 0.15;
  return { candidate, score: Math.min(1, Number(score.toFixed(4))), evidence: breakdown };
}

export function rankMatchCandidates(input: { evidence: MatchEvidenceIdentity; candidates: MatchCandidate[] }): RankedMatchCandidate[] {
  return input.candidates
    .map((candidate) => scoreCandidate(input.evidence, candidate))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
}

export function resolveCanonicalMatch(input: { evidence: MatchEvidenceIdentity; candidates: MatchCandidate[] }): MatchResolution {
  const ranked = rankMatchCandidates(input);
  const top = ranked[0];
  if (!top || top.score < 0.65) return { status: 'unmatched', confidence: top?.score ?? 0 };
  const tied = ranked.filter((item) => Math.abs(item.score - top.score) < 0.0001);
  if (tied.length > 1) return { status: 'ambiguous', candidateIds: tied.map((item) => item.candidate.id), confidence: top.score };
  const second = ranked[1];
  if (second && top.score - second.score < 0.15 && second.score >= 0.65) {
    return { status: 'ambiguous', candidateIds: [top.candidate.id, second.candidate.id], confidence: top.score };
  }
  return { status: 'matched', matchId: top.candidate.id, confidence: top.score };
}
