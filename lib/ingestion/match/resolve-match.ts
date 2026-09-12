export type MatchEvidenceIdentity = {
  date?: string;
  opponentName?: string;
  homeAway?: 'home' | 'away' | 'neutral' | 'unknown';
  setScores?: string[];
  sourceMatchId?: string;
};

export type MatchCandidate = {
  id: string;
  date?: string;
  opponentNames: string[];
  homeAway?: 'home' | 'away' | 'neutral' | 'unknown';
  setScores?: string[];
  sourceMatchIds?: string[];
};

export type MatchResolution =
  | { status: 'matched'; matchId: string; confidence: number }
  | { status: 'ambiguous'; candidateIds: string[]; confidence: number }
  | { status: 'unmatched'; confidence: number };

const normalize = (value: string | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const scoreSets = (a?: string[], b?: string[]) => !!a && !!b && a.length === b.length && a.every((v, i) => normalize(v) === normalize(b[i]));

function scoreCandidate(evidence: MatchEvidenceIdentity, candidate: MatchCandidate): number {
  let score = 0;
  if (evidence.sourceMatchId && candidate.sourceMatchIds?.includes(evidence.sourceMatchId)) return 1;
  if (evidence.date && candidate.date && evidence.date === candidate.date) score += 0.35;
  if (evidence.opponentName && candidate.opponentNames.some((name) => normalize(name) === normalize(evidence.opponentName))) score += 0.35;
  if (evidence.homeAway && candidate.homeAway && evidence.homeAway !== 'unknown' && candidate.homeAway !== 'unknown' && evidence.homeAway === candidate.homeAway) score += 0.15;
  if (scoreSets(evidence.setScores, candidate.setScores)) score += 0.15;
  return Math.min(1, Number(score.toFixed(4)));
}

export function resolveCanonicalMatch(input: { evidence: MatchEvidenceIdentity; candidates: MatchCandidate[] }): MatchResolution {
  const ranked = input.candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(input.evidence, candidate) }))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
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
