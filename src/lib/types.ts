export type ProgramContext = {
  programId:string; seasonId:string; seasonYear:number; teamId:string;
  schoolName:string|null; schoolAbbreviation:string; teamName:string; primaryColor:string; secondaryColor:string; accentColor:string;
  role:'owner'|'staff'|'player';
  canCorrectData:boolean;
};
export type RosterRow={id:string;number?:string|null;name:string;officialPosition?:string|null;classYear?:string|null;height?:string|null;hometown?:string|null;previousSchool?:string|null;imageUrl?:string|null};
export type MatchRow={id:string;scheduledAt:string;opponentName:string;homeAway:string;location?:string|null;result?:string|null;dataStatus:string};
export type MatchSummaryMetric={matchId:string;subject:'our_team'|'opponent';metric:string;value:number;numerator?:number;opportunities?:number;engineVersion:string};
export type MatchSummaryData={
  id:string;scheduledAt:string;homeAway:string;location?:string|null;result?:string|null;setScoresJson?:string|null;opponentName:string;dataStatus:string;
  metrics:MatchSummaryMetric[];findings:any[];sources:any[];
  rallyAnalytics:{
    metrics:MatchSummaryMetric[];
    sideoutPathways:{
      our_team:Record<'first_ball_sideout'|'regular_sideout'|'unknown_phase',number>;
      opponent:Record<'first_ball_sideout'|'regular_sideout'|'unknown_phase',number>;
    };
    unsupported:string[];
    serviceRuns:Array<{teamSide:string;setNumber:number;pointsWon:number;serveAttempts:number;serverSourceKey?:string}>;
    scoreIntegrity:{status:'verified'|'conflict'|'unknown';conflictedSets:number[]};
  };
};

export type ImportQualitySummaryData={
  dataLevel:'Basic'|'Standard'|'Rich';sourceLabel:string;rallyCount:number;directlyVerifiedCount:number;reconciledCount:number;unresolvedCount:number;structuralConflictCount:number;suppressedScope:'none'|'field_or_rally'|'set';
};
export type MatchReviewCandidate={matchId:string;canonicalOpponentName:string;date?:string;homeAway?:string;setScores?:string[];result?:string;confidence:number;matchedEvidence:string[]};
export type MatchImportReviewData={sourceArtifactId:string;imported:{date?:string;opponentName?:string;homeAway?:string;setScores?:string[];sourceMatchId?:string;result?:string};suggested?:MatchReviewCandidate;candidates:MatchReviewCandidate[]};
export type MatchImportResult={status:'enriched'|'duplicate'|'needs_review';sourceArtifactId?:string;matchId?:string;observationCount?:number;quality?:ImportQualitySummaryData;review?:MatchImportReviewData;analytics?:{metricCount:number;findingCount:number}};
export type DataQualityIssue={id:string;issue_type:string;entity_id?:string|null;status:string;details?:Record<string,unknown>;created_at:string};
export type DataQualityRally={entityId:string;setNumber:number;rallyNumber:number;scoreBefore:{our:number;opponent:number};scoreAfter:{our:number;opponent:number};servingSide?:'our_team'|'opponent';receivingSide?:'our_team'|'opponent';pointWinner:'our_team'|'opponent';terminal:any|null;sourceTerminal:any|null;pathway:string;attribution:string;evidenceStatus:string;issues:DataQualityIssue[];sourceLinks:any[]};
export type MatchDataQualityData={matchId:string;canonicalRevision:number;issues:{open:DataQualityIssue[];resolved:DataQualityIssue[]};rallies:DataQualityRally[];timelineEvents:any[];overrides:any[];history:any[]};
