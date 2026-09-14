export type ProgramContext = {
  programId:string; seasonId:string; seasonYear:number; teamId:string;
  schoolName:string|null; schoolAbbreviation:string; teamName:string; primaryColor:string; secondaryColor:string; accentColor:string;
  role:'owner'|'staff'|'player';
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
