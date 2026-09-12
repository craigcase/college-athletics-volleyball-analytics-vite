import { detectSourceFamily, type SourceFamily } from '../ingestion/source-family';
import { parseMatchSource } from '../ingestion/match/parse-source';
import { preserveSource } from '../../db/repositories/sources';
import { resolveMatchForEvidence, attachEvidenceToMatch } from '../../db/repositories/matches';
import { getAdminClient } from '../../db/client';
import { assertNoError } from '../../db/supabase-utils';
import { id, nowIso } from '../ids';

const PARSER_VERSION='ingestion-1.0.0';
export async function importMatchBytes(input:{programId:string;seasonId:string;bytes:Uint8Array;sourceUrl?:string;fileName?:string;contentType?:string;actorEmail:string;ourTeamNames?:string[]}){
  const sourceFamily=detectSourceFamily({fileName:input.fileName,contentType:input.contentType,bytes:input.bytes});
  const source=await preserveSource({...input,sourceFamily,importedBy:input.actorEmail,parserVersion:PARSER_VERSION});
  let linkedMatchId:string|undefined;
  if(source.duplicate){
    const link=await getAdminClient().from('match_source_links').select('match_id').eq('source_artifact_id',source.id).limit(1).maybeSingle();
    assertNoError(link.error,'Read existing match source link');linkedMatchId=(link.data as any)?.match_id;
  }
  if(source.duplicate&&linkedMatchId)return {status:'duplicate' as const,sourceArtifactId:source.id,matchId:linkedMatchId};
  const text=new TextDecoder().decode(input.bytes);
  const parsed=parseMatchSource({text,sourceFamily,sourceUrl:input.sourceUrl??`upload://${input.fileName??'source'}`,ourTeamNames:input.ourTeamNames});
  const resolution=await resolveMatchForEvidence(input.programId,input.seasonId,{date:parsed.match.date,opponentName:parsed.match.opponentName,homeAway:parsed.match.homeAway,setScores:parsed.match.setScores,sourceMatchId:parsed.match.sourceMatchId});
  if(resolution.status!=='matched'){
    const issue=await getAdminClient().from('reconciliation_issues').insert({id:id('issue'),program_id:input.programId,issue_type:resolution.status==='ambiguous'?'ambiguous_match_identity':'unmatched_source',entity_type:'match',source_artifact_id:source.id,details_json:JSON.stringify({resolution,matchEvidence:parsed.match}),status:'open',created_at:nowIso()});
    assertNoError(issue.error,'Create match identity issue');
    return {status:'needs_review' as const,sourceArtifactId:source.id,resolution,sourceFamily,observationCount:parsed.observations.length};
  }
  const attached=await attachEvidenceToMatch({programId:input.programId,matchId:resolution.matchId,sourceArtifactId:source.id,sourceFamily:sourceFamily as SourceFamily,lineageId:source.lineageId,matchConfidence:resolution.confidence,observations:parsed.observations,actorEmail:input.actorEmail});
  return {status:'enriched' as const,sourceArtifactId:source.id,sourceFamily,observationCount:parsed.observations.length,...attached};
}
