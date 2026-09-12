import { getAdminClient } from '../client';
import { assertNoError, byId } from '../supabase-utils';
import { id, nowIso } from '../../lib/ids';
import type { EvidenceObservation } from '../../lib/ingestion/types';
import type { SourceFamily } from '../../lib/ingestion/source-family';
import { sourceConfidence } from '../../lib/ingestion/confidence';
import { resolveCanonicalMatch, type MatchEvidenceIdentity } from '../../lib/ingestion/match/resolve-match';
import { recalculateMatch } from './analytics';

export async function resolveMatchForEvidence(programId:string,seasonId:string,evidence:MatchEvidenceIdentity){
  const db=getAdminClient();
  const matchesResult=await db.from('matches').select('id,scheduled_at,home_away,set_scores_json,source_match_id,opponent_team_id').eq('program_id',programId).eq('season_id',seasonId);
  assertNoError(matchesResult.error,'Read canonical matches');
  const matches=(matchesResult.data??[]) as any[];
  const opponentIds=[...new Set(matches.map(m=>m.opponent_team_id).filter(Boolean))];
  const [teamsResult,aliasesResult]=await Promise.all([
    opponentIds.length?db.from('teams').select('id,canonical_name').in('id',opponentIds):Promise.resolve({data:[],error:null} as any),
    opponentIds.length?db.from('team_aliases').select('team_id,alias').in('team_id',opponentIds):Promise.resolve({data:[],error:null} as any),
  ]);
  assertNoError(teamsResult.error,'Read match teams');assertNoError(aliasesResult.error,'Read team aliases');
  const teams=byId((teamsResult.data??[]) as any[]);
  const aliases=new Map<string,string[]>();
  for(const row of (aliasesResult.data??[]) as any[])aliases.set(row.team_id,[...(aliases.get(row.team_id)??[]),row.alias]);
  const candidates=matches.map(m=>({id:m.id,date:String(m.scheduled_at).slice(0,10),opponentNames:[(teams.get(m.opponent_team_id) as any)?.canonical_name,...(aliases.get(m.opponent_team_id)??[])].filter(Boolean),homeAway:m.home_away,setScores:m.set_scores_json?JSON.parse(m.set_scores_json):undefined,sourceMatchIds:m.source_match_id?[m.source_match_id]:undefined}));
  return resolveCanonicalMatch({evidence,candidates});
}

export async function attachEvidenceToMatch(input:{programId:string;matchId:string;sourceArtifactId:string;sourceFamily:SourceFamily;lineageId:string;matchConfidence:number;observations:EvidenceObservation[];actorEmail:string}){
  const db=getAdminClient(),now=nowIso();
  const linked=await db.from('match_source_links').select('id').eq('match_id',input.matchId).eq('source_artifact_id',input.sourceArtifactId).maybeSingle();
  assertNoError(linked.error,'Check match source link');
  if(linked.data)return {duplicate:true,matchId:input.matchId};
  const link=await db.from('match_source_links').insert({id:id('matchsource'),match_id:input.matchId,source_artifact_id:input.sourceArtifactId,match_confidence:input.matchConfidence,created_at:now});assertNoError(link.error,'Attach match source');
  if(input.observations.length){
    const rows=input.observations.map(o=>({id:id('obs'),program_id:input.programId,source_artifact_id:input.sourceArtifactId,match_id:input.matchId,entity_type:o.entityType,source_entity_key:o.entityKey,field_name:o.field,value_json:JSON.stringify(o.value),set_number:o.setNumber??null,rally_index:o.rallyIndex??null,source_confidence:sourceConfidence(input.sourceFamily,o.field),observed_at:now}));
    const obs=await db.from('evidence_observations').insert(rows);assertNoError(obs.error,'Persist match evidence');
  }
  const match=await db.from('matches').select('canonical_revision').eq('id',input.matchId).maybeSingle();assertNoError(match.error,'Read match revision');
  if(!match.data)throw new Error('MATCH_NOT_FOUND');
  const revision=Number((match.data as any).canonical_revision??1)+1;
  const revisionUpdate=await db.from('matches').update({canonical_revision:revision,updated_at:now}).eq('id',input.matchId);assertNoError(revisionUpdate.error,'Advance match revision');
  const activity=await db.from('activity_events').insert({id:id('activity'),program_id:input.programId,actor_email:input.actorEmail,action:'match.evidence_attached',entity_type:'match',entity_id:input.matchId,details_json:JSON.stringify({sourceArtifactId:input.sourceArtifactId,sourceFamily:input.sourceFamily,observationCount:input.observations.length}),created_at:now});assertNoError(activity.error,'Create match activity');
  const analytics=await recalculateMatch(input.matchId);
  return {duplicate:false,matchId:input.matchId,analytics};
}
