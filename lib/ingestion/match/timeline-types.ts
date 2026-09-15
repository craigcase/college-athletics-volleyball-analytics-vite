export type TeamSide = 'our_team' | 'opponent';
export type ScoreState = { our: number; opponent: number };
export type VbgameProducer = 'presto_vbgame' | 'livestats_vbgame' | 'genius_vbgame' | 'unknown_vbgame';

export type TerminalEventType =
  | 'kill'
  | 'attack_error'
  | 'service_ace'
  | 'service_error'
  | 'stuff_block'
  | 'setting_error'
  | 'ball_handling_error'
  | 'blocking_error'
  | 'penalty_point'
  | 'unknown';

export type TerminalRelatedEvent = {
  type: TerminalEventType;
  teamSide?: TeamSide;
  playerSourceKey?: string;
};

export type TerminalEvent = {
  type: TerminalEventType;
  teamSide?: TeamSide;
  playerSourceKey?: string;
  assistSourceKeys?: string[];
  blockerSourceKeys?: string[];
  receiverSourceKey?: string;
  relatedEvents?: TerminalRelatedEvent[];
  rawText: string;
};

export type RallyPathway =
  | 'first_ball_sideout'
  | 'regular_sideout'
  | 'transition_point'
  | 'direct_serve_point'
  | 'unknown_phase';

export type PointAttribution = 'earned' | 'given' | 'pressure_created' | 'unknown';

export type SetScoreIntegrity = {
  setNumber: number;
  officialFinalScore: ScoreState;
  sourceFinalScore: ScoreState;
  status: 'verified' | 'conflict';
};

export type ParsedScoringRecord = {
  setNumber: number;
  sourceKey: string;
  sourceOrdinal: number;
  servingSide?: TeamSide;
  serverSourceKey?: string;
  pointWinner: TeamSide;
  scoreAfter: ScoreState;
  rawText: string;
  terminal?: TerminalEvent;
};

export type ParsedTimelineEvent = {
  setNumber: number;
  sourceKey: string;
  sourceOrdinal: number;
  type: 'timeout' | 'substitution' | 'penalty' | 'challenge' | 'official_adjustment' | 'starter_announcement';
  teamSide?: TeamSide;
  rawText: string;
};

export type ParsedTimelineDraft = {
  producer: VbgameProducer | 'public_sidearm';
  setFinalScores: Array<{ setNumber: number; score: ScoreState }>;
  scoringRecords: ParsedScoringRecord[];
  timelineEvents: ParsedTimelineEvent[];
};

export type CanonicalRallyDraft = {
  setNumber: number;
  rallyNumber: number;
  scoreBefore: ScoreState;
  scoreAfter: ScoreState;
  servingSide?: TeamSide;
  receivingSide?: TeamSide;
  serverSourceKey?: string;
  pointWinner: TeamSide;
  terminal?: TerminalEvent;
  pathway: RallyPathway;
  attribution: PointAttribution;
  evidenceStatus: 'supported' | 'gap_placeholder' | 'ambiguous' | 'uniquely_reconciled' | 'staff_confirmed';
  sourceLinks: Array<{ sourceKey: string; sourceOrdinal: number; confidence: number }>;
};

export type CanonicalTimelineDraft = {
  rallies: CanonicalRallyDraft[];
  timelineEvents: ParsedTimelineEvent[];
  setScoreIntegrity: SetScoreIntegrity[];
};
