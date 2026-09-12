export type ProgramContext = {
  programId:string; seasonId:string; seasonYear:number; teamId:string;
  schoolAbbreviation:string; teamName:string; primaryColor:string; secondaryColor:string; accentColor:string;
  role:'owner'|'staff'|'player';
};
export type RosterRow={id:string;number?:string|null;name:string;officialPosition?:string|null;classYear?:string|null;height?:string|null;hometown?:string|null;previousSchool?:string|null;imageUrl?:string|null};
export type MatchRow={id:string;scheduledAt:string;opponentName:string;homeAway:string;location?:string|null;result?:string|null;dataStatus:string};
export type MatchSummaryData={id:string;scheduledAt:string;homeAway:string;location?:string|null;result?:string|null;setScoresJson?:string|null;opponentName:string;dataStatus:string;metrics:any[];findings:any[];sources:any[]};
