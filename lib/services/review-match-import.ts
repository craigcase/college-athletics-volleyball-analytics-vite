import { loadStoredSource } from '../../db/repositories/sources.js';
import { createMatchFromEvidence, getMatchReviewSelection, saveTrustedOpponentAlias } from '../../db/repositories/matches.js';
import { getAdminClient } from '../../db/client.js';
import { assertNoError } from '../../db/supabase-utils.js';
import { parseMatchSource } from '../ingestion/match/parse-source.js';
import { finalizeMatchImport, MATCH_PARSER_VERSION } from './import-match.js';
import { nowIso } from '../ids.js';

export type MatchImportReviewAction='confirm'|'choose_existing'|'create_missing';

export async function reviewMatchImport(input:{
  programId:string;seasonId:string;ourTeamId:string;sourceArtifactId:string;action:MatchImportReviewAction;matchId?:string;
  actorEmail:string;ourTeamNames:string[];canCorrectData:boolean;
}){
  if(!input.canCorrectData)throw new Error('DATA_CORRECTION_FORBIDDEN');
  const stored=await loadStoredSource({programId:input.programId,sourceArtifactId:input.sourceArtifactId});
  const text=new TextDecoder().decode(stored.bytes);
  const parsed=parseMatchSource({text,sourceFamily:stored.sourceFamily,sourceUrl:stored.sourceUrl??`upload://${stored.fileName??'source'}`,ourTeamNames:input.ourTeamNames});

  let selected:{matchId:string;opponentTeamId:string};
  if(input.action==='create_missing'){
    selected=await createMatchFromEvidence({programId:input.programId,seasonId:input.seasonId,ourTeamId:input.ourTeamId,evidence:parsed.match,actorEmail:input.actorEmail});
  }else{
    if(!input.matchId)throw new Error('MATCH_REVIEW_SELECTION_REQUIRED');
    selected=await getMatchReviewSelection(input.programId,input.seasonId,input.matchId);
  }

  if(parsed.match.opponentName){
    await saveTrustedOpponentAlias({programId:input.programId,teamId:selected.opponentTeamId,alias:parsed.match.opponentName,sourceArtifactId:stored.id,actorEmail:input.actorEmail});
  }

  const resolved=await getAdminClient().from('reconciliation_issues').update({status:'resolved',resolved_by_email:input.actorEmail,resolved_at:nowIso()}).eq('program_id',input.programId).eq('source_artifact_id',stored.id).in('issue_type',['ambiguous_match_identity','unmatched_source']).eq('status','open');
  assertNoError(resolved.error,'Resolve match identity review');

  return finalizeMatchImport({programId:input.programId,matchId:selected.matchId,sourceArtifactId:stored.id,sourceFamily:stored.sourceFamily,lineageId:stored.lineageId,matchConfidence:1,parsed,actorEmail:input.actorEmail,reprocess:stored.parserVersion!==MATCH_PARSER_VERSION,sourceParserVersion:stored.parserVersion});
}
