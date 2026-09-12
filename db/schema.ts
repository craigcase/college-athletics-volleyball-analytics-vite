// Source-neutral canonical schema contract. The executable migration is in drizzle/0000_initial.sql.
export const tables = {
  programs: 'programs', seasons: 'seasons', programMemberships: 'program_memberships',
  teams: 'teams', teamAliases: 'team_aliases', teamSeasons: 'team_seasons',
  players: 'players', playerAliases: 'player_aliases', playerSeasons: 'player_seasons',
  matches: 'matches', matchSets: 'match_sets', sourceLineages: 'source_lineages',
  sourceArtifacts: 'source_artifacts', matchSourceLinks: 'match_source_links',
  evidenceObservations: 'evidence_observations', canonicalOverrides: 'canonical_overrides',
  reconciliationIssues: 'reconciliation_issues', matchCapabilities: 'match_capabilities',
  matchTeamTotals: 'match_team_totals', playerMatchTotals: 'player_match_totals',
  matchMetricResults: 'match_metric_results', matchFindings: 'match_findings', activityEvents: 'activity_events',
} as const;
