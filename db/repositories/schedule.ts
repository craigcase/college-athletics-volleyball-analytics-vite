import { getAdminClient } from '../client';
import { assertNoError, byId } from '../supabase-utils';
import { id, nowIso } from '../../lib/ids';
import type { ScheduleEvidence } from '../../lib/ingestion/schedule/sidearm';
import { planScheduleRefresh } from '../../lib/ingestion/schedule/refresh';

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export async function upsertScheduleEvidence(input:{programId:string;seasonId:string;ourTeamId:string;matches:ScheduleEvidence[];actorEmail:string;sourceArtifactId:string}){
  const db=getAdminClient(),now=nowIso();let added=0,changed=0,unchanged=0;
  const [currentResult,allAliasesResult]=await Promise.all([
    db.from('matches').select('*').eq('season_id',input.seasonId),
    db.from('team_aliases').select('team_id,alias'),
  ]);
  assertNoError(currentResult.error,'Read season matches');assertNoError(allAliasesResult.error,'Read team aliases');
  const currentMatches=((currentResult.data??[]) as any[]);
  const aliasMap=new Map<string,string>(((allAliasesResult.data??[]) as any[]).map(row=>[norm(row.alias),row.team_id]));
  const teamIds=[...new Set(currentMatches.map(row=>row.opponent_team_id).filter(Boolean))];
  const teamResult=teamIds.length?await db.from('teams').select('id,canonical_name').in('id',teamIds):{data:[],error:null};
  assertNoError((teamResult as any).error,'Read opponent teams');
  const teamMap=byId((((teamResult as any).data??[]) as any[]));

  for(const ev of input.matches){
    let teamId=aliasMap.get(norm(ev.opponentName));
    if(!teamId){teamId=id('team');const team=await db.from('teams').insert({id:teamId,canonical_name:ev.opponentName,created_at:now});assertNoError(team.error,'Create opponent team');const alias=await db.from('team_aliases').insert({id:id('teamalias'),team_id:teamId,alias:ev.opponentName,source_family:'official_schedule',created_at:now});assertNoError(alias.error,'Create opponent alias');aliasMap.set(norm(ev.opponentName),teamId);}
    let existing:any=null;
    if(ev.sourceMatchId)existing=currentMatches.find(row=>row.source_match_id===ev.sourceMatchId)??null;
    if(!existing){
      existing=currentMatches.find(row=>String(row.scheduled_at).slice(0,10)===ev.date.slice(0,10)&&norm((teamMap.get(row.opponent_team_id) as any)?.canonical_name??(row.opponent_team_id===teamId?ev.opponentName:''))===norm(ev.opponentName)&&row.home_away===ev.homeAway)??null;
    }
    if(!existing){
      added++;existing={id:id('match'),program_id:input.programId,season_id:input.seasonId,our_team_id:input.ourTeamId,opponent_team_id:teamId,scheduled_at:ev.date,home_away:ev.homeAway??'unknown',competition:'unknown',location:ev.location??null,status:ev.result?'completed':'scheduled',result:ev.result??null,set_scores_json:ev.setScores?JSON.stringify(ev.setScores):null,source_match_id:ev.sourceMatchId??null,canonical_revision:1,created_at:now,updated_at:now};
      const insert=await db.from('matches').insert(existing);assertNoError(insert.error,'Create schedule match');currentMatches.push(existing);teamMap.set(teamId,{id:teamId,canonical_name:ev.opponentName} as any);
    }else{
      const incoming={scheduledAt:ev.date,homeAway:ev.homeAway??'unknown',location:ev.location??null,result:ev.result??null,setScoresJson:ev.setScores?JSON.stringify(ev.setScores):null};
      const current={scheduledAt:existing.scheduled_at,homeAway:existing.home_away,location:existing.location??null,result:existing.result??null,setScoresJson:existing.set_scores_json??null};
      const plan=planScheduleRefresh(current,incoming);
      if(plan.status==='unchanged')unchanged++;
      else if(plan.status==='enrich'){
        changed++;
        const patch:any={updated_at:now};
        if(existing.location==null&&plan.patch.location!=null)patch.location=plan.patch.location;
        if(existing.result==null&&plan.patch.result!=null){patch.result=plan.patch.result;patch.status='completed';}
        if(existing.set_scores_json==null&&plan.patch.setScoresJson!=null)patch.set_scores_json=plan.patch.setScoresJson;
        const update=await db.from('matches').update(patch).eq('id',existing.id);assertNoError(update.error,'Enrich schedule match');Object.assign(existing,patch);
      }else{
        changed++;
        const issue=await db.from('reconciliation_issues').insert({id:id('issue'),program_id:input.programId,issue_type:'schedule_change',entity_type:'match',entity_id:existing.id,details_json:JSON.stringify({current,proposed:incoming,conflictingFields:plan.conflictingFields}),status:'open',created_at:now});assertNoError(issue.error,'Create schedule change issue');
      }
    }

    const link=await db.from('match_source_links').upsert({id:id('matchsource'),match_id:existing.id,source_artifact_id:input.sourceArtifactId,match_confidence:0.95,created_at:now},{onConflict:'match_id,source_artifact_id',ignoreDuplicates:true});
    assertNoError(link.error,'Link schedule source');
    const fields={date:ev.date,opponentName:ev.opponentName,homeAway:ev.homeAway,location:ev.location,result:ev.result,setScores:ev.setScores,sourceMatchId:ev.sourceMatchId,boxScoreUrl:ev.boxScoreUrl};
    const existingObs=await db.from('evidence_observations').select('field_name').eq('source_artifact_id',input.sourceArtifactId).eq('entity_type','match').eq('entity_id',existing.id);
    assertNoError(existingObs.error,'Read schedule observations');
    const existingFields=new Set(((existingObs.data??[]) as any[]).map(row=>row.field_name));
    const observations=Object.entries(fields).filter(([,value])=>value!==undefined).filter(([field])=>!existingFields.has(field)).map(([field,value])=>({id:id('observation'),program_id:input.programId,source_artifact_id:input.sourceArtifactId,match_id:existing.id,entity_type:'match',entity_id:existing.id,source_entity_key:ev.sourceMatchId??null,field_name:field,value_json:JSON.stringify(value),source_confidence:0.9,observed_at:now}));
    if(observations.length){const insertObs=await db.from('evidence_observations').insert(observations);assertNoError(insertObs.error,'Persist schedule observations');}
  }
  const activity=await db.from('activity_events').insert({id:id('activity'),program_id:input.programId,actor_email:input.actorEmail,action:'schedule.imported',entity_type:'schedule',details_json:JSON.stringify({added,changed,unchanged}),created_at:now});assertNoError(activity.error,'Create schedule activity');
  return {added,changed,unchanged,total:input.matches.length};
}

export async function listMatches(programId:string,seasonId:string){
  const db=getAdminClient();
  const matchesResult=await db.from('matches').select('*').eq('program_id',programId).eq('season_id',seasonId).order('scheduled_at',{ascending:true});
  assertNoError(matchesResult.error,'List matches');
  const matches=(matchesResult.data??[]) as any[];
  const teamIds=[...new Set(matches.map(m=>m.opponent_team_id).filter(Boolean))];
  const matchIds=matches.map(m=>m.id);
  const [teamsResult,capsResult]=await Promise.all([
    teamIds.length?db.from('teams').select('id,canonical_name').in('id',teamIds):Promise.resolve({data:[],error:null} as any),
    matchIds.length?db.from('match_capabilities').select('*').in('match_id',matchIds):Promise.resolve({data:[],error:null} as any),
  ]);
  assertNoError(teamsResult.error,'Read match opponents');assertNoError(capsResult.error,'Read match capabilities');
  const teams=byId((teamsResult.data??[]) as any[]),caps=new Map(((capsResult.data??[]) as any[]).map(row=>[row.match_id,row]));
  return matches.map(m=>{
    const c:any=caps.get(m.id);
    const dataStatus=c?.contact_quality||c?.attack_destination?'Rich Data':c?.rally_sequence||c?.set_totals?'Standard Data':c?.box_score_totals?'Basic Data':'No Data Yet';
    return {id:m.id,scheduledAt:m.scheduled_at,homeAway:m.home_away,location:m.location,status:m.status,result:m.result,setScoresJson:m.set_scores_json,canonicalRevision:m.canonical_revision,opponentName:(teams.get(m.opponent_team_id) as any)?.canonical_name??'Opponent',dataStatus};
  });
}
