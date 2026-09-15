import { detectSourceFamily, type SourceFamily } from '../ingestion/source-family';
import { parseMatchSource, type ParsedMatchSource } from '../ingestion/match/parse-source';
import { buildCanonicalTimeline } from '../ingestion/match/timeline-builder';
import { auditTimelineAgainstTotals } from '../ingestion/reconciliation/audit';
import { buildImportQualitySummary } from '../ingestion/reconciliation/quality';
import { deriveServingCycle } from '../ingestion/match/rotation-state';
import { buildMatchReview } from '../ingestion/match/review';
import { preserveSource, updateSourceParserVersion } from '../../db/repositories/sources';
import { resolveMatchForEvidence, getMatchReviewCandidates, attachEvidenceToMatch } from '../../db/repositories/matches';
import { replaceCanonicalTimeline } from '../../db/repositories/rallies';
import { recalculateMatch } from '../../db/repositories/analytics';
import { getAdminClient } from '../../db/client.js';
import { assertNoError } from '../../db/supabase-utils';
import { id, nowIso } from '../ids';

const PARSER_VERSION='ingestion-2.1.2';
export const MATCH_PARSER_VERSION=PARSER_VERSION;

export async function finalizeMatchImport(input:{
  programId:string;matchId:string;sourceArtifactId:string;sourceFamily:SourceFamily;lineageId:string;matchConfidence:number;
  parsed:ParsedMatchSource;actorEmail:string;reprocess?:boolean;sourceParserVersion?:string;
}){
  const attached=await attachEvidenceToMatch({programId:input.programId,matchId:input.matchId,sourceArtifactId:input.sourceArtifactId,sourceFamily:input.sourceFamily,lineageId:input.lineageId,matchConfidence:input.matchConfidence,observations:input.parsed.observations,actorEmail:input.actorEmail,reprocess:input.reprocess});
  if(attached.duplicate)return {status:'duplicate' as const,sourceArtifactId:input.sourceArtifactId,matchId:input.matchId};

  const canonicalRevision=attached.canonicalRevision;
  let timelineStats={rallyCount:0,placeholderCount:0};
  let canonicalTimeline:ReturnType<typeof buildCanonicalTimeline>|undefined;
  if(input.parsed.timeline){
    const builtTimeline=buildCanonicalTimeline(input.parsed.timeline);
    const audit=auditTimelineAgainstTotals({timeline:builtTimeline,observations:input.parsed.observations});
    const timeline=audit.timeline;
    canonicalTimeline=timeline;
    const rotations=deriveServingCycle(timeline.rallies);
    timelineStats=await replaceCanonicalTimeline({programId:input.programId,matchId:input.matchId,sourceArtifactId:input.sourceArtifactId,canonicalRevision,timeline,rotations});
    for(const finding of audit.findings){
      const issueId=`issue_rally_detail_${input.matchId}_${finding.setNumber}_${finding.rallyNumber}`;
      const issue=await getAdminClient().from('reconciliation_issues').upsert({
        id:issueId,program_id:input.programId,issue_type:finding.status==='uniquely_reconciled'?'rally_detail_reconciled':'unresolved_rally_detail',entity_type:'match_rally',entity_id:`${input.matchId}:${finding.setNumber}:${finding.rallyNumber}`,source_artifact_id:input.sourceArtifactId,
        details_json:JSON.stringify({...finding,canonicalRevision}),status:finding.status==='unresolved'?'open':'resolved',resolved_by_email:finding.status==='unresolved'?null:input.actorEmail,resolved_at:finding.status==='unresolved'?null:nowIso(),created_at:nowIso(),
      },{onConflict:'id'});
      assertNoError(issue.error,'Record rally evidence quality issue');
    }
    for(const setIntegrity of timeline.setScoreIntegrity){
      const issueId=`issue_rally_score_${input.matchId}_${setIntegrity.setNumber}`;
      if(setIntegrity.status==='conflict'){
        const issue=await getAdminClient().from('reconciliation_issues').upsert({
          id:issueId,program_id:input.programId,issue_type:'rally_score_conflict',entity_type:'match_set',entity_id:`${input.matchId}:${setIntegrity.setNumber}`,source_artifact_id:input.sourceArtifactId,
          details_json:JSON.stringify({setNumber:setIntegrity.setNumber,officialFinalScore:setIntegrity.officialFinalScore,sourceFinalScore:setIntegrity.sourceFinalScore,canonicalRevision}),
          status:'open',resolved_by_email:null,resolved_at:null,created_at:nowIso(),
        },{onConflict:'id'});
        assertNoError(issue.error,'Record rally score conflict');
      }else{
        const resolved=await getAdminClient().from('reconciliation_issues').update({status:'resolved',resolved_by_email:input.actorEmail,resolved_at:nowIso()}).eq('id',issueId).eq('status','open');
        assertNoError(resolved.error,'Resolve rally score conflict');
      }
    }
  }
  const analytics=await recalculateMatch(input.matchId);
  const quality=buildImportQualitySummary({sourceFamily:input.sourceFamily,producer:input.parsed.producer,timeline:canonicalTimeline});
  if(input.reprocess||input.sourceParserVersion!==PARSER_VERSION)await updateSourceParserVersion(input.sourceArtifactId,PARSER_VERSION);
  return {status:'enriched' as const,sourceArtifactId:input.sourceArtifactId,sourceFamily:input.sourceFamily,observationCount:input.parsed.observations.length,...attached,...timelineStats,quality,analytics};
}

export async function importMatchBytes(input:{programId:string;seasonId:string;bytes:Uint8Array;sourceUrl?:string;fileName?:string;contentType?:string;actorEmail:string;ourTeamNames?:string[]}){
  const sourceFamily=detectSourceFamily({fileName:input.fileName,contentType:input.contentType,bytes:input.bytes});
  const source=await preserveSource({...input,sourceFamily,importedBy:input.actorEmail,parserVersion:PARSER_VERSION});
  let linkedMatchId:string|undefined;
  if(source.duplicate){
    const link=await getAdminClient().from('match_source_links').select('match_id').eq('source_artifact_id',source.id).limit(1).maybeSingle();
    assertNoError(link.error,'Read existing match source link');linkedMatchId=(link.data as any)?.match_id;
  }
  if(source.duplicate&&linkedMatchId&&source.parserVersion===PARSER_VERSION)return {status:'duplicate' as const,sourceArtifactId:source.id,matchId:linkedMatchId};

  const text=new TextDecoder().decode(input.bytes);
  const parsed=parseMatchSource({text,sourceFamily,sourceUrl:input.sourceUrl??`upload://${input.fileName??'source'}`,ourTeamNames:input.ourTeamNames});
  const resolution=linkedMatchId
    ? {status:'matched' as const,matchId:linkedMatchId,confidence:1}
    : await resolveMatchForEvidence(input.programId,input.seasonId,{date:parsed.match.date,opponentName:parsed.match.opponentName,homeAway:parsed.match.homeAway,setScores:parsed.match.setScores,sourceMatchId:parsed.match.sourceMatchId,result:parsed.match.result});
  if(resolution.status!=='matched'){
    const issue=await getAdminClient().from('reconciliation_issues').insert({id:id('issue'),program_id:input.programId,issue_type:resolution.status==='ambiguous'?'ambiguous_match_identity':'unmatched_source',entity_type:'match',source_artifact_id:source.id,details_json:JSON.stringify({resolution,matchEvidence:parsed.match}),status:'open',created_at:nowIso()});
    assertNoError(issue.error,'Create match identity issue');
    const ranked=await getMatchReviewCandidates(input.programId,input.seasonId,parsed.match);
    const review=buildMatchReview({sourceArtifactId:source.id,evidence:parsed.match,ranked});
    return {status:'needs_review' as const,sourceArtifactId:source.id,resolution,review:review,sourceFamily,observationCount:parsed.observations.length};
  }
  const reprocess=source.duplicate&&source.parserVersion!==PARSER_VERSION;
  return finalizeMatchImport({programId:input.programId,matchId:resolution.matchId,sourceArtifactId:source.id,sourceFamily:sourceFamily as SourceFamily,lineageId:source.lineageId,matchConfidence:resolution.confidence,parsed,actorEmail:input.actorEmail,reprocess,sourceParserVersion:source.parserVersion});
}
