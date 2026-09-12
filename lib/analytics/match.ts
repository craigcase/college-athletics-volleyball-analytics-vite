import { calculateHittingPercentage } from './hitting.js';
import { ANALYTICS_ENGINE_VERSION, type AnalyticsSubject, type MatchMetricResult } from './types.js';

type TeamTotals = { kills?: number; attackErrors?: number; attackAttempts?: number; aces?: number; serviceErrors?: number };
type Input = {
  matchId: string;
  canonicalRevision: number;
  capabilities: { boxScoreTotals?: boolean };
  teams: Partial<Record<AnalyticsSubject, TeamTotals>>;
};

function valid(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

export function calculateMatchAnalytics(input: Input): MatchMetricResult[] {
  if (!input.capabilities.boxScoreTotals) return [];
  const out: MatchMetricResult[] = [];
  for (const subject of ['our_team', 'opponent'] as const) {
    const totals = input.teams[subject];
    if (!totals) continue;
    const base = { matchId: input.matchId, subject, engineVersion: ANALYTICS_ENGINE_VERSION, canonicalRevision: input.canonicalRevision };
    const simple = [
      ['kills', totals.kills], ['attack_errors', totals.attackErrors], ['attack_attempts', totals.attackAttempts],
      ['aces', totals.aces], ['service_errors', totals.serviceErrors]
    ] as const;
    for (const [metric, value] of simple) if (valid(value)) out.push({ ...base, metric, value });
    if (valid(totals.kills) && valid(totals.attackErrors) && valid(totals.attackAttempts)) {
      const hp = calculateHittingPercentage({ kills: totals.kills, errors: totals.attackErrors, attempts: totals.attackAttempts });
      if (hp !== null) out.push({ ...base, metric: 'hitting_percentage', numerator: totals.kills - totals.attackErrors, denominator: totals.attackAttempts, value: hp });
    }
  }
  return out;
}
