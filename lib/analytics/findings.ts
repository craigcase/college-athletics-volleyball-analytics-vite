import type { MatchMetricResult } from './types.js';
export type MatchFinding = {
  metric: string;
  direction: 'our_advantage' | 'opponent_advantage';
  ourValue: number;
  opponentValue: number;
  magnitude: number;
  opportunities?: number;
  rankScore: number;
};

const THRESHOLDS: Record<string, number> = { hitting_percentage: 0.05, aces: 2, service_errors: 2, kills: 4 };

export function rankMatchFindings(metrics: MatchMetricResult[]): MatchFinding[] {
  const byMetric = new Map<string, Partial<Record<'our_team'|'opponent', MatchMetricResult>>>();
  for (const m of metrics) {
    const row = byMetric.get(m.metric) ?? {};
    row[m.subject] = m;
    byMetric.set(m.metric, row);
  }
  const findings: MatchFinding[] = [];
  for (const [metric, pair] of byMetric) {
    if (!pair.our_team || !pair.opponent || !(metric in THRESHOLDS)) continue;
    const delta = pair.our_team.value - pair.opponent.value;
    const magnitude = Math.abs(delta);
    if (magnitude < THRESHOLDS[metric]) continue;
    const opportunities = pair.our_team.denominator;
    const reliability = opportunities ? Math.min(1, opportunities / 60) : 0.75;
    findings.push({ metric, direction: delta >= 0 ? 'our_advantage' : 'opponent_advantage', ourValue: pair.our_team.value, opponentValue: pair.opponent.value, magnitude, opportunities, rankScore: magnitude * reliability });
  }
  return findings.sort((a,b) => b.rankScore - a.rankScore).slice(0,5);
}
