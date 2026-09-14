import type { CanonicalRallyDraft, TeamSide } from '../ingestion/match/timeline-types.js';

export type ServiceRun = {
  teamSide: TeamSide;
  setNumber: number;
  startRallyNumber: number;
  endRallyNumber: number;
  pointsWon: number;
  serveAttempts: number;
  serverSourceKey?: string;
};

export function buildServiceRuns(rallies:CanonicalRallyDraft[]):ServiceRun[]{
  const runs:ServiceRun[]=[];
  let active:ServiceRun|undefined;
  const ordered=[...rallies].sort((a,b)=>a.setNumber-b.setNumber||a.rallyNumber-b.rallyNumber);
  const close=()=>{if(active){runs.push(active);active=undefined;}};
  for(const rally of ordered){
    if(!rally.servingSide){close();continue;}
    if(!active||active.setNumber!==rally.setNumber||active.teamSide!==rally.servingSide){
      close();
      active={teamSide:rally.servingSide,setNumber:rally.setNumber,startRallyNumber:rally.rallyNumber,endRallyNumber:rally.rallyNumber,pointsWon:0,serveAttempts:0,...(rally.serverSourceKey?{serverSourceKey:rally.serverSourceKey}:{})};
    }
    active.endRallyNumber=rally.rallyNumber;
    active.serveAttempts+=1;
    if(rally.pointWinner===active.teamSide)active.pointsWon+=1;
    else close();
  }
  close();
  return runs;
}
