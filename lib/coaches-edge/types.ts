export type MetricCode =
  | 'hitting_percentage'
  | 'kills'
  | 'attack_errors'
  | 'attack_attempts'
  | 'aces'
  | 'service_errors'
  | 'sideout_percentage'
  | 'point_scored_percentage'
  | 'score1_percentage'
  | 'sos2_percentage'
  | 'epo_percentage'
  | 'longest_service_run';
export type StructuredAnalyticsQuery = {
  intent: 'compare_metric' | 'match_summary' | 'top_finding' | 'metric_finding_status';
  scope: { matchId: string };
  metric?: MetricCode;
  subjects?: ('our_team' | 'opponent')[];
  comparison?: 'more' | 'fewer';
  findingSide?: 'our_team' | 'opponent' | 'either';
};
export type StoredMetric = {
  matchId: string;
  subject: 'our_team' | 'opponent';
  metric: MetricCode;
  value: number;
  numerator?: number;
  opportunities?: number;
  engineVersion: string;
};
export type StoredFinding = {
  matchId: string;
  side: 'our_team' | 'opponent';
  metric: MetricCode;
  direction: 'our_advantage' | 'opponent_advantage';
  magnitude: number;
  opportunities?: number;
  rankScore: number;
  ourValue: number;
  opponentValue: number;
  engineVersion: string;
};
