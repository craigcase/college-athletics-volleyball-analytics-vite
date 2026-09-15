import { getAdminClient } from '../client.js';
import { assertNoError } from '../supabase-utils.js';
import { id, nowIso } from '../../lib/ids.js';
import { loadCanonicalRallies } from './rallies.js';
import type { RallyOverrideField } from '../../lib/ingestion/reconciliation/overrides.js';

const parseJson=(value:any)=>{if(value==null)return null;try{return typeof value==='string'?JSON.parse(value):value;}catch{return value;}};
const entityId=(matchId:string,setNumber:number,rallyNumber:number)=>`${matchId}:${setNumber}:${rallyNumber}`;

export async function getMatchDataQuality(programId:string,matchId:string){
  const db=getAdminClient();
  const matchResult=await db.from('matches').select('id,program_id,canonical_revision').eq('id',matchId).eq('program_id',programId).maybeSingle();
  assertNoError(matchResult.error,'Read data-quality match');
  const match=matchResult.data as any;if(!match)throw new Error('MATCH_NOT_FOUND');
  const revision=Number(match.canonical_revision??1);
  const [issuesResult,rawRalliesResult,eventsResult,overridesResult,historyResult,sourceLinksResult]=await Promise.all([
    db.from('reconciliation_issues').select('*').eq('program_id',programId).or(`entity_id.like.${matchId}:%,entity_id.eq.${matchId}`).order('created_at',{ascending:false}),
    db.from('match_rallies').select('*').eq('match_id',matchId).eq('canonical_revision',revision).order('set_number',{ascending:true}).order('rally_number',{ascending:true}),
    db.from('match_timeline_events').select('*').eq('match_id',matchId).eq('canonical_revision',revision).order('set_number',{ascending:true}).order('source_ordinal',{ascending:true}),
    db.from('canonical_overrides').select('*').eq('program_id',programId).eq('entity_type','match_rally').like('entity_id',`${matchId}:%`),
    db.from('canonical_override_history').select('*').eq('program_id',programId).eq('entity_type','match_rally').like('entity_id',`${matchId}:%`).order('created_at',{ascending:false}),
    db.from('rally_source_links').select('rally_id,source_artifact_id,source_record_key,source_ordinal,alignment_confidence,reconciliation_status').like('rally_id',`rally_${matchId}_${revision}_%`),
  ]);
  for(const [result,label] of [[issuesResult,'issues'],[rawRalliesResult,'rallies'],[eventsResult,'events'],[overridesResult,'overrides'],[historyResult,'history'],[sourceLinksResult,'source links']] as const)assertNoError(result.error,`Read data-quality ${label}`);
  const current=await loadCanonicalRallies(matchId,revision);
  const rawByKey=new Map(((rawRalliesResult.data??[]) as any[]).map(row=>[`${row.set_number}:${row.rally_number}`,row]));
  const issues=((issuesResult.data??[]) as any[]).map(row=>({...row,details:parseJson(row.details_json)}));
  const issueByEntity=new Map<string,any[]>();for(const issue of issues){const rows=issueByEntity.get(issue.entity_id)??[];rows.push(issue);issueByEntity.set(issue.entity_id,rows);}
  const linksByRally=new Map<string,any[]>();for(const row of (sourceLinksResult.data??[]) as any[]){const rows=linksByRally.get(row.rally_id)??[];rows.push(row);linksByRally.set(row.rally_id,rows);}
  const rallies=current.map(rally=>{
    const raw=rawByKey.get(`${rally.setNumber}:${rally.rallyNumber}`) as any;
    const eid=entityId(matchId,rally.setNumber,rally.rallyNumber);
    const rallyId=raw?.id;
    return {entityId:eid,setNumber:rally.setNumber,rallyNumber:rally.rallyNumber,scoreBefore:rally.scoreBefore,scoreAfter:rally.scoreAfter,servingSide:rally.servingSide,receivingSide:rally.receivingSide,pointWinner:rally.pointWinner,terminal:rally.terminal??null,pathway:rally.pathway,attribution:rally.attribution,evidenceStatus:rally.evidenceStatus,sourceTerminal:parseJson(raw?.terminal_json),issues:issueByEntity.get(eid)??[],sourceLinks:rallyId?(linksByRally.get(rallyId)??[]):[]};
  });
  return {matchId,canonicalRevision:revision,issues:{open:issues.filter(row=>row.status==='open'),resolved:issues.filter(row=>row.status!=='open')},rallies,timelineEvents:(eventsResult.data??[]),overrides:(overridesResult.data??[]),history:(historyResult.data??[])};
}

export async function setRallyOverride(input:{programId:string;matchId:string;setNumber:number;rallyNumber:number;fieldName:RallyOverrideField;value:unknown;reason?:string|null;actorEmail:string}){
  const db=getAdminClient();const eid=entityId(input.matchId,input.setNumber,input.rallyNumber);
  const match=await db.from('matches').select('id,canonical_revision').eq('id',input.matchId).eq('program_id',input.programId).maybeSingle();assertNoError(match.error,'Read correction match');if(!match.data)throw new Error('MATCH_NOT_FOUND');
  const rally=await db.from('match_rallies').select('id').eq('match_id',input.matchId).eq('canonical_revision',(match.data as any).canonical_revision).eq('set_number',input.setNumber).eq('rally_number',input.rallyNumber).maybeSingle();assertNoError(rally.error,'Read correction rally');if(!rally.data)throw new Error('RALLY_NOT_FOUND');
  const existing=await db.from('canonical_overrides').select('*').eq('program_id',input.programId).eq('entity_type','match_rally').eq('entity_id',eid).eq('field_name',input.fieldName).maybeSingle();assertNoError(existing.error,'Read active correction');
  const now=nowIso();const previous=(existing.data as any)?.canonical_value_json??null;const next=JSON.stringify(input.value);
  const write=await db.from('canonical_overrides').upsert({id:(existing.data as any)?.id??id('override'),program_id:input.programId,entity_type:'match_rally',entity_id:eid,field_name:input.fieldName,canonical_value_json:next,reason:input.reason??null,corrected_by_email:input.actorEmail,corrected_at:now},{onConflict:'program_id,entity_type,entity_id,field_name'});assertNoError(write.error,'Save staff correction');
  const history=await db.from('canonical_override_history').insert({id:id('override_history'),program_id:input.programId,entity_type:'match_rally',entity_id:eid,field_name:input.fieldName,action:existing.data?'replace':'apply',previous_value_json:previous,new_value_json:next,reason:input.reason??null,actor_email:input.actorEmail,created_at:now});assertNoError(history.error,'Record correction history');
  const resolved=await db.from('reconciliation_issues').update({status:'resolved',resolved_by_email:input.actorEmail,resolved_at:now}).eq('program_id',input.programId).eq('entity_type','match_rally').eq('entity_id',eid).eq('issue_type','unresolved_rally_detail').eq('status','open');assertNoError(resolved.error,'Resolve corrected data issue');
  return {entityId:eid,fieldName:input.fieldName,value:input.value};
}

export async function removeRallyOverride(input:{programId:string;matchId:string;setNumber:number;rallyNumber:number;fieldName:RallyOverrideField;reason?:string|null;actorEmail:string}){
  const db=getAdminClient();const eid=entityId(input.matchId,input.setNumber,input.rallyNumber);const existing=await db.from('canonical_overrides').select('*').eq('program_id',input.programId).eq('entity_type','match_rally').eq('entity_id',eid).eq('field_name',input.fieldName).maybeSingle();assertNoError(existing.error,'Read correction to undo');if(!existing.data)throw new Error('CORRECTION_NOT_FOUND');
  const now=nowIso();const deleted=await db.from('canonical_overrides').delete().eq('id',(existing.data as any).id);assertNoError(deleted.error,'Undo staff correction');
  const history=await db.from('canonical_override_history').insert({id:id('override_history'),program_id:input.programId,entity_type:'match_rally',entity_id:eid,field_name:input.fieldName,action:'undo',previous_value_json:(existing.data as any).canonical_value_json,new_value_json:null,reason:input.reason??null,actor_email:input.actorEmail,created_at:now});assertNoError(history.error,'Record correction undo');
  const reopened=await db.from('reconciliation_issues').update({status:'open',resolved_by_email:null,resolved_at:null}).eq('program_id',input.programId).eq('entity_type','match_rally').eq('entity_id',eid).in('issue_type',['unresolved_rally_detail']);assertNoError(reopened.error,'Reopen unresolved data issue');
  return {entityId:eid,fieldName:input.fieldName};
}
