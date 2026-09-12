export type MetricCode = 'hitting_percentage' | 'kills' | 'attack_errors' | 'attack_attempts' | 'aces' | 'service_errors';
export type StructuredAnalyticsQuery = {
  intent: 'compare_metric' | 'match_summary';
  scope: { matchId: string };
  metric?: MetricCode;
  subjects?: ('our_team' | 'opponent')[];
};
export type StoredMetric = {
  matchId: string;
  subject: 'our_team' | 'opponent';
  metric: MetricCode;
  value: number;
  opportunities?: number;
  engineVersion: string;
};
