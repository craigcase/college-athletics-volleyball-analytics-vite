export const ANALYTICS_ENGINE_VERSION = '1.0.0';
export type AnalyticsSubject = 'our_team' | 'opponent';
export type MatchMetricCode = 'hitting_percentage' | 'kills' | 'attack_errors' | 'attack_attempts' | 'aces' | 'service_errors';
export type MatchMetricResult = {
  matchId: string;
  subject: AnalyticsSubject;
  metric: MatchMetricCode;
  numerator?: number;
  denominator?: number;
  value: number;
  engineVersion: string;
  canonicalRevision: number;
};
