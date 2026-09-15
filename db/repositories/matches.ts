import { getAdminClient } from '../client.js';
import { assertNoError, byId } from '../supabase-utils';
import { id, nowIso } from '../../lib/ids';
import type { EvidenceObservation } from '../../lib/ingestion/types';
import type { SourceFamily } from '../../lib/ingestion/source-family';
import { sourceConfidence } from '../../lib/ingestion/confidence';
import { rankMatchCandidates, resolveCanonicalMatch, type MatchCandidate, type MatchEvidenceIdentity } from '../../lib/ingestion/match/resolve-match';

async function matchCandidates(programId:string,seasonId:string):Promise<MatchCandidate[]>{
  const db=getAdminClient();
  const matchesResult=await db.from('matches').select('id,scheduled_at,home_away,set_scores_json,source_match_id,opponent_team_id,result').eq('program_id',programId).eq('season_id',seasonId);
  assertNoError(matchesResult.error,'Read canonical matches');
  const matches=(matchesResult.data??[]) as any[];
  const opponentIds=[...new Set(matches.map(m=>m.opponent_team_id).filter(Boolean))];
  const [teamsResult,aliasesResult,trustedResult]=await Promise.all([
    opponentIds.length?db.from('teams').select('id,canonical_name').in('id',opponentIds):Promise.resolve({data:[],error:null} as any),
    opponentIds.length?db.from('team_aliases').select('team_id,alias').in('team_id',opponentIds):Promise.resolve({data:[],error:null} as any),
    opponentIds.length?db.from('program_opponent_aliases').select('team_id,alias').eq('program_id',programId).is('revoked_at',null).in('team_id',opponentIds):Promise.resolve({data:[],error:null} as any),
  ]);
  assertNoError(teamsResult.error,'Read match teams');assertNoError(aliasesResult.error,'Read team aliases');assertNoError(trustedResult.error,'Read trusted opponent aliases');
  const teams=byId((teamsResult.data??[]) as any[]);
  const aliases=new Map<string,string[]>();
  for(const row of [...((aliasesResult.data??[]) as any[]),...((trustedResult.data??[]) as any[])])aliases.set(row.team_id,[...(aliases.get(row.team_id)??[]),row.alias]);
  return matches.map(m=>({id:m.id,date:String(m.scheduled_at).slice(0,10),opponentNames:[(teams.get(m.opponent_team_id) as any)?.canonical_name,...(aliases.get(m.opponent_team_id)??[])].filter(Boolean),homeAway:m.home_away,setScores:m.set_scores_json?JSON.parse(m.set_scores_json):undefined,sourceMatchIds:m.source_match_id?[m.source_match_id]:undefined,result:m.result??undefined,opponentTeamId:m.opponent_team_id??undefined}));
}

export async function resolveMatchForEvidence(programId:string,seasonId:string,evidence:MatchEvidenceIdentity){
  const candidates=await matchCandidates(programId,seasonId);
  return resolveCanonicalMatch({evidence,candidates});
}

export async function getMatchReviewCandidates(programId:string,seasonId:string,evidence:MatchEvidenceIdentity){
  const candidates=await matchCandidates(programId,seasonId);
  return rankMatchCandidates({evidence,candidates});
}

const normalizeTrustedAlias=(value:string)=>value.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();

export async function saveTrustedOpponentAlias(input:{programId:string;teamId:string;alias:string;sourceArtifactId?:string;actorEmail:string}){
  const alias=input.alias.trim();
  if(!alias)return;
  const db=getAdminClient(),now=nowIso(),normalized=normalizeTrustedAlias(alias);
  const existing=await db.from('program_opponent_aliases').select('id,team_id,revoked_at').eq('program_id',input.programId).eq('normalized_alias',normalized).maybeSingle();
  assertNoError(existing.error,'Read trusted opponent alias');
  const row=existing.data as any;
  if(row?.id){
    const updated=await db.from('program_opponent_aliases').update({team_id:input.teamId,alias,source_artifact_id:input.sourceArtifactId??null,confirmed_by_email:input.actorEmail,confirmed_at:now,revoked_by_email:null,revoked_at:null}).eq('id',row.id);
    assertNoError(updated.error,'Update trusted opponent alias');
    return;
  }
  const inserted=await db.from('program_opponent_aliases').insert({id:id('programalias'),program_id:input.programId,team_id:input.teamId,alias,normalized_alias:normalized,source_family:'staff_confirmed',source_artifact_id:input.sourceArtifactId??null,confirmed_by_email:input.actorEmail,confirmed_at:now});
  assertNoError(inserted.error,'Create trusted opponent alias');
}

export async function createMatchFromEvidence(input:{programId:string;seasonId:string;ourTeamId:string;evidence:MatchEvidenceIdentity;actorEmail:string}){
  if(!input.evidence.date||!input.evidence.opponentName)throw new Error('MATCH_EVIDENCE_INCOMPLETE');
  const db=getAdminClient(),now=nowIso();
  const teamId=id('team'),matchId=id('match');
  const team=await db.from('teams').insert({id:teamId,canonical_name:input.evidence.opponentName,created_at:now});
  assertNoError(team.error,'Create missing opponent team');
  const alias=await db.from('team_aliases').insert({id:id('teamalias'),team_id:teamId,alias:input.evidence.opponentName,source_family:'staff_confirmed_import',created_at:now});
  assertNoError(alias.error,'Create missing opponent alias');
  const match=await db.from('matches').insert({id:matchId,program_id:input.programId,season_id:input.seasonId,our_team_id:input.ourTeamId,opponent_team_id:teamId,scheduled_at:`${input.evidence.date}T12:00:00Z`,home_away:input.evidence.homeAway??'unknown',status:'completed',result:input.evidence.result??null,set_scores_json:input.evidence.setScores?JSON.stringify(input.evidence.setScores):null,source_match_id:input.evidence.sourceMatchId??null,created_at:now,updated_at:now});
  if(match.error){await db.from('teams').delete().eq('id',teamId);assertNoError(match.error,'Create missing canonical match');}
  const activity=await db.from('activity_events').insert({id:id('activity'),program_id:input.programId,actor_email:input.actorEmail,action:'match.created_from_import_review',entity_type:'match',entity_id:matchId,details_json:JSON.stringify({opponentName:input.evidence.opponentName,date:input.evidence.date}),created_at:now});
  assertNoError(activity.error,'Record imported match creation');
  return {matchId,opponentTeamId:teamId};
}

export async function getMatchReviewSelection(programId:string,seasonId:string,matchId:string){
  const db=getAdminClient();
  const result=await db.from('matches').select('id,opponent_team_id').eq('id',matchId).eq('program_id',programId).eq('season_id',seasonId).maybeSingle();
  assertNoError(result.error,'Read selected match');
  const row=result.data as any;
  if(!row)throw new Error('MATCH_NOT_FOUND');
  if(!row.opponent_team_id)throw new Error('MATCH_OPPONENT_NOT_FOUND');
  return {matchId:row.id,opponentTeamId:row.opponent_team_id as string};
}


export async function attachEvidenceToMatch(input:{programId:string;matchId:string;sourceArtifactId:string;sourceFamily:SourceFamily;lineageId:string;matchConfidence:number;observations:EvidenceObservation[];actorEmail:string;reprocess?:boolean}){
  const db=getAdminClient(),now=nowIso();
  const linked=await db.from('match_source_links').select('id').eq('match_id',input.matchId).eq('source_artifact_id',input.sourceArtifactId).maybeSingle();
  assertNoError(linked.error,'Check match source link');
  if(linked.data&&!input.reprocess)return {duplicate:true,matchId:input.matchId};
  if(!linked.data){
    const link=await db.from('match_source_links').insert({id:id('matchsource'),match_id:input.matchId,source_artifact_id:input.sourceArtifactId,match_confidence:input.matchConfidence,created_at:now});assertNoError(link.error,'Attach match source');
  }else{
    const stale=await db.from('evidence_observations').delete().eq('match_id',input.matchId).eq('source_artifact_id',input.sourceArtifactId);
    assertNoError(stale.error,'Clear stale parsed match evidence');
  }
  if(input.observations.length){
    const rows=input.observations.map(o=>({id:id('obs'),program_id:input.programId,source_artifact_id:input.sourceArtifactId,match_id:input.matchId,entity_type:o.entityType,source_entity_key:o.entityKey,field_name:o.field,value_json:JSON.stringify(o.value),set_number:o.setNumber??null,rally_index:o.rallyIndex??null,source_confidence:sourceConfidence(input.sourceFamily,o.field),observed_at:now}));
    const obs=await db.from('evidence_observations').insert(rows);assertNoError(obs.error,'Persist match evidence');
  }
  const match=await db.from('matches').select('canonical_revision').eq('id',input.matchId).maybeSingle();assertNoError(match.error,'Read match revision');
  if(!match.data)throw new Error('MATCH_NOT_FOUND');
  const revision=Number((match.data as any).canonical_revision??1)+1;
  const revisionUpdate=await db.from('matches').update({canonical_revision:revision,updated_at:now}).eq('id',input.matchId);assertNoError(revisionUpdate.error,'Advance match revision');
  const activity=await db.from('activity_events').insert({id:id('activity'),program_id:input.programId,actor_email:input.actorEmail,action:input.reprocess?'match.evidence_reprocessed':'match.evidence_attached',entity_type:'match',entity_id:input.matchId,details_json:JSON.stringify({sourceArtifactId:input.sourceArtifactId,sourceFamily:input.sourceFamily,observationCount:input.observations.length,canonicalRevision:revision}),created_at:now});assertNoError(activity.error,'Create match activity');
  return {duplicate:false,matchId:input.matchId,canonicalRevision:revision};
}
