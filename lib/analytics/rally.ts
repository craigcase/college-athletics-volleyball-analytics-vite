import { ANALYTICS_ENGINE_VERSION, type AnalyticsSubject, type MatchMetricResult, type RallyMetricCode } from './types.js';
import { buildServiceRuns } from './service-runs.js';
import type { CanonicalRallyDraft, SetScoreIntegrity, TeamSide } from '../ingestion/match/timeline-types.js';

const subjects:AnalyticsSubject[]=['our_team','opponent'];
const opposite=(side:TeamSide):TeamSide=>side==='our_team'?'opponent':'our_team';

function percentageMetric(input:{matchId:string;canonicalRevision:number;subject:AnalyticsSubject;metric:RallyMetricCode;numerator:number;denominator:number}):MatchMetricResult|undefined{
  if(input.denominator<=0)return undefined;
  return {...input,value:input.numerator/input.denominator,engineVersion:ANALYTICS_ENGINE_VERSION};
}

function bySet(rallies:CanonicalRallyDraft[]):Map<number,CanonicalRallyDraft[]>{
  const sets=new Map<number,CanonicalRallyDraft[]>();
  for(const rally of [...rallies].sort((a,b)=>a.setNumber-b.setNumber||a.rallyNumber-b.rallyNumber)){
    const rows=sets.get(rally.setNumber)??[];rows.push(rally);sets.set(rally.setNumber,rows);
  }
  return sets;
}

export function calculateRallyAnalytics(input:{matchId:string;canonicalRevision:number;rallies:CanonicalRallyDraft[];setScoreIntegrity?:SetScoreIntegrity[]}):MatchMetricResult[]{
  if(input.setScoreIntegrity?.some(row=>row.status==='conflict'))return [];
  const out:MatchMetricResult[]=[];
  const sets=bySet(input.rallies);

  for(const subject of subjects){
    let sideoutN=0,sideoutD=0,psN=0,psD=0,score1N=0,score1D=0,sos2N=0,sos2D=0,epoN=0,epoD=0;
    for(const rallies of sets.values()){
      for(let i=0;i<rallies.length;i+=1){
        const rally=rallies[i];
        if(rally.servingSide){
          if(rally.servingSide===subject){psD+=1;if(rally.pointWinner===subject)psN+=1;}
          if(opposite(rally.servingSide)===subject){sideoutD+=1;if(rally.pointWinner===subject)sideoutN+=1;}
        }

        const isSupportedSideout=rally.receivingSide===subject&&rally.pointWinner===subject;
        if(isSupportedSideout){
          const first=rallies[i+1];
          if(first){
            score1D+=1;
            if(first.pointWinner===subject)score1N+=1;

            if(first.pointWinner!==subject){
              sos2D+=1;
            }else{
              const second=rallies[i+2];
              if(second){
                sos2D+=1;
                if(second.pointWinner===subject)sos2N+=1;
              }
            }
          }
        }

        if(rally.pointWinner===subject&&rally.attribution==='given'){
          const next=rallies[i+1];
          if(next){
            epoD+=1;
            if(next.pointWinner===subject)epoN+=1;
          }
        }
      }
    }
    for(const [metric,numerator,denominator] of [
      ['sideout_percentage',sideoutN,sideoutD],
      ['point_scored_percentage',psN,psD],
      ['score1_percentage',score1N,score1D],
      ['sos2_percentage',sos2N,sos2D],
      ['epo_percentage',epoN,epoD],
    ] as const){
      const result=percentageMetric({matchId:input.matchId,canonicalRevision:input.canonicalRevision,subject,metric,numerator,denominator});
      if(result)out.push(result);
    }
  }

  const runs=buildServiceRuns(input.rallies);
  for(const subject of subjects){
    const subjectRuns=runs.filter(run=>run.teamSide===subject);
    if(subjectRuns.length){
      const longest=Math.max(...subjectRuns.map(run=>run.pointsWon));
      out.push({matchId:input.matchId,subject,metric:'longest_service_run',value:longest,engineVersion:ANALYTICS_ENGINE_VERSION,canonicalRevision:input.canonicalRevision});
    }
  }
  return out;
}
