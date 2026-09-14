import { getAdminClient } from '../client.js';
import { assertNoError } from '../supabase-utils';
import { id, nowIso } from '../../lib/ids';
import { detectCapabilities, type RallyCapabilityFacts } from '../../lib/capabilities/detect';
import { calculateMatchAnalytics } from '../../lib/analytics/match';
import { calculateRallyAnalytics } from '../../lib/analytics/rally';
import { buildServiceRuns } from '../../lib/analytics/service-runs';
import { loadCanonicalRallies, loadRallyScoreIntegrity } from './rallies';
import { rankMatchFindings } from '../../lib/analytics/findings';
import { reconcileField } from '../../lib/ingestion/reconcile';
import type { EvidenceObservation } from '../../lib/ingestion/types';
import type { StoredFinding, StoredMetric } from '../../lib/coaches-edge/types';

const numericFields=['kills','attack_errors','attack_attempts','assists','aces','service_errors','digs','blocks','reception_errors'] as const;

export async function recalculateMatch(matchId:string):Promise<{canonicalRevision:number;metricCount:number;findingCount:number}>{
  const db=getAdminClient();
  const matchResult=await db.from('matches').select('id,program_id,canonical_revision').eq('id',matchId).maybeSingle();
  assertNoError(matchResult.error,'Read analytics match');
  const match=matchResult.data as any;if(!match)throw new Error('MATCH_NOT_FOUND');
  const rowsResult=await db.from('evidence_observations').select('entity_type,source_entity_key,field_name,value_json,set_number,rally_index,source_confidence,source_artifact_id').eq('match_id',matchId);
  assertNoError(rowsResult.error,'Read match evidence observations');
  const rows=(rowsResult.data??[]) as any[];
  const artifactIds=[...new Set(rows.map(r=>r.source_artifact_id).filter(Boolean))];
  const artifactsResult=artifactIds.length?await db.from('source_artifacts').select('id,lineage_id').in('id',artifactIds):{data:[],error:null};
  assertNoError((artifactsResult as any).error,'Read evidence lineages');
  const lineageMap=new Map((((artifactsResult as any).data??[]) as any[]).map(r=>[r.id,r.lineage_id??r.id]));
  const observations:EvidenceObservation[]=rows.map(r=>({entityType:r.entity_type,entityKey:r.source_entity_key??'',field:r.field_name,value:JSON.parse(r.value_json),...(r.set_number!=null?{setNumber:r.set_number}:{}),...(r.rally_index!=null?{rallyIndex:r.rally_index}:{})}));
  const revision=Number(match.canonical_revision??1);
  const [ralliesResult,timelineResult,phasesResult,eventsResult]=await Promise.all([
    db.from('match_rallies').select('serving_side,terminal_event_type').eq('match_id',matchId).eq('canonical_revision',revision),
    db.from('match_timeline_events').select('event_type').eq('match_id',matchId).eq('canonical_revision',revision),
    db.from('rally_phases').select('transition_depth,match_rallies!inner(match_id,canonical_revision)').eq('match_rallies.match_id',matchId).eq('match_rallies.canonical_revision',revision),
    db.from('rally_events').select('occurred_at_seconds,match_rallies!inner(match_id,canonical_revision)').eq('match_rallies.match_id',matchId).eq('match_rallies.canonical_revision',revision),
  ]);
  assertNoError(ralliesResult.error,'Read rally capability facts');assertNoError(timelineResult.error,'Read timeline capability facts');assertNoError(phasesResult.error,'Read phase capability facts');assertNoError(eventsResult.error,'Read contact capability facts');
  const rallyRows=(ralliesResult.data??[]) as any[],timelineRows=(timelineResult.data??[]) as any[],phaseRows=(phasesResult.data??[]) as any[],eventRows=(eventsResult.data??[]) as any[];
  const rallyFacts:RallyCapabilityFacts={
    rallyCount:rallyRows.length,
    knownServeStateCount:rallyRows.filter(r=>r.serving_side).length,
    terminalDetailCount:rallyRows.filter(r=>r.terminal_event_type).length,
    timeoutCount:timelineRows.filter(r=>r.event_type==='timeout').length,
    substitutionCount:timelineRows.filter(r=>r.event_type==='substitution').length,
    phaseCount:phaseRows.length,
    transitionDepthCount:phaseRows.filter(r=>r.transition_depth!=null).length,
    contactCount:eventRows.length,
    timestampCount:eventRows.filter(r=>r.occurred_at_seconds!=null).length,
  };
  const capabilities=detectCapabilities({evidence:{observations},rallyFacts});
  const teams:any={};

  for(const side of ['us','opponent'] as const){
    const totals:any={};
    for(const field of numericFields){
      const sourceRows=rows.filter(r=>r.entity_type==='team'&&r.source_entity_key===side&&r.field_name===field);
      if(!sourceRows.length)continue;
      const overrideResult=await db.from('canonical_overrides').select('canonical_value_json').eq('program_id',match.program_id).eq('entity_type','match_team').eq('entity_id',`${matchId}:${side}`).eq('field_name',field).maybeSingle();
      assertNoError(overrideResult.error,'Read match override');
      const override=overrideResult.data as any;
      const reconciled=reconcileField({observations:sourceRows.map(r=>({value:JSON.parse(r.value_json),sourceConfidence:Number(r.source_confidence),lineageId:lineageMap.get(r.source_artifact_id)??r.source_artifact_id})),...(override?{override:{value:JSON.parse(override.canonical_value_json)}}:{})});
      if(reconciled.status==='resolved'&&typeof reconciled.value==='number')totals[field]=reconciled.value;
      else if(reconciled.status==='conflict'){
        const issue=await db.from('reconciliation_issues').insert({id:id('issue'),program_id:match.program_id,issue_type:'field_conflict',entity_type:'match_team',entity_id:`${matchId}:${side}`,details_json:JSON.stringify({field,values:reconciled.values}),status:'open',created_at:nowIso()});
        assertNoError(issue.error,'Create field conflict');
      }
    }
    teams[side==='us'?'our_team':'opponent']={kills:totals.kills,attackErrors:totals.attack_errors,attackAttempts:totals.attack_attempts,aces:totals.aces,serviceErrors:totals.service_errors};
    const totalRow={id:`teamtotal_${matchId}_${side}_${revision}`,match_id:matchId,team_side:side==='us'?'our_team':'opponent',canonical_revision:revision,kills:totals.kills??null,attack_errors:totals.attack_errors??null,attack_attempts:totals.attack_attempts??null,assists:totals.assists??null,aces:totals.aces??null,service_errors:totals.service_errors??null,digs:totals.digs??null,blocks:totals.blocks??null,reception_errors:totals.reception_errors??null,updated_at:nowIso()};
    const totalWrite=await db.from('match_team_totals').upsert(totalRow,{onConflict:'match_id,team_side,canonical_revision'});assertNoError(totalWrite.error,'Persist match team totals');
  }

  const [canonicalRallies,setScoreIntegrity]=await Promise.all([loadCanonicalRallies(matchId,revision),loadRallyScoreIntegrity(matchId,revision)]);
  const boxMetrics=calculateMatchAnalytics({matchId,canonicalRevision:revision,capabilities,teams});
  const rallyMetrics=capabilities.rallySequence&&canonicalRallies.length?calculateRallyAnalytics({matchId,canonicalRevision:revision,rallies:canonicalRallies,setScoreIntegrity}):[];
  const metrics=[...boxMetrics,...rallyMetrics];
  const findings=rankMatchFindings(metrics);
  const capabilityWrite=await db.from('match_capabilities').upsert({match_id:matchId,canonical_revision:revision,box_score_totals:capabilities.boxScoreTotals,player_totals:capabilities.playerTotals,set_totals:capabilities.setTotals,rally_sequence:capabilities.rallySequence,serve_receive_state:capabilities.serveReceiveState,rotation_state:capabilities.rotationState,on_court_state:capabilities.onCourtState,contact_quality:capabilities.contactQuality,attack_origin:capabilities.attackOrigin,attack_destination:capabilities.attackDestination,terminal_event_detail:capabilities.terminalEventDetail,timeout_timeline:capabilities.timeoutTimeline,substitution_timeline:capabilities.substitutionTimeline,offensive_phase:capabilities.offensivePhase,transition_depth:capabilities.transitionDepth,contact_sequence:capabilities.contactSequence,timestamps:capabilities.timestamps,updated_at:nowIso()},{onConflict:'match_id'});
  assertNoError(capabilityWrite.error,'Persist match capabilities');
  const [deleteMetrics,deleteFindings]=await Promise.all([
    db.from('match_metric_results').delete().eq('match_id',matchId).eq('canonical_revision',revision),
    db.from('match_findings').delete().eq('match_id',matchId).eq('canonical_revision',revision),
  ]);
  assertNoError(deleteMetrics.error,'Clear stale metrics');assertNoError(deleteFindings.error,'Clear stale findings');
  if(metrics.length){
    const rowsToInsert=metrics.map(m=>({id:id('metric'),match_id:matchId,canonical_revision:revision,subject:m.subject,metric_code:m.metric,numerator:m.numerator??null,denominator:m.denominator??null,value:m.value,status:'supported',engine_version:m.engineVersion,calculated_at:nowIso()}));
    const result=await db.from('match_metric_results').insert(rowsToInsert);assertNoError(result.error,'Persist deterministic metrics');
  }
  if(findings.length){
    const rowsToInsert=findings.map(f=>({id:id('finding'),match_id:matchId,canonical_revision:revision,side:f.direction==='our_advantage'?'our_team':'opponent',metric_code:f.metric,direction:f.direction,magnitude:f.magnitude,opportunities:f.opportunities??null,rank_score:f.rankScore,evidence_json:JSON.stringify({ourValue:f.ourValue,opponentValue:f.opponentValue}),engine_version:metrics[0]?.engineVersion??'1.0.0',created_at:nowIso()}));
    const result=await db.from('match_findings').insert(rowsToInsert);assertNoError(result.error,'Persist match findings');
  }
  return {canonicalRevision:revision,metricCount:metrics.length,findingCount:findings.length};
}

export async function getStoredMetrics(matchId:string):Promise<StoredMetric[]>{
  const db=getAdminClient();
  const match=await db.from('matches').select('canonical_revision').eq('id',matchId).maybeSingle();assertNoError(match.error,'Read metric revision');if(!match.data)return[];
  const result=await db.from('match_metric_results').select('match_id,subject,metric_code,value,numerator,denominator,engine_version').eq('match_id',matchId).eq('canonical_revision',(match.data as any).canonical_revision);
  assertNoError(result.error,'Read stored metrics');
  return ((result.data??[]) as any[]).map(r=>({matchId:r.match_id,subject:r.subject,metric:r.metric_code,value:r.value,numerator:r.numerator==null?undefined:Number(r.numerator),opportunities:r.denominator==null?undefined:Number(r.denominator),engineVersion:r.engine_version}));
}



export async function getStoredFindings(matchId:string):Promise<StoredFinding[]> {
  const db=getAdminClient();
  const match=await db.from('matches').select('canonical_revision').eq('id',matchId).maybeSingle();
  assertNoError(match.error,'Read finding revision');
  if(!match.data)return[];
  const result=await db.from('match_findings')
    .select('match_id,side,metric_code,direction,magnitude,opportunities,rank_score,evidence_json,engine_version')
    .eq('match_id',matchId)
    .eq('canonical_revision',(match.data as any).canonical_revision)
    .order('rank_score',{ascending:false});
  assertNoError(result.error,'Read stored findings');
  return ((result.data??[]) as any[]).flatMap(row=>{
    let evidence:any={};
    try{evidence=typeof row.evidence_json==='string'?JSON.parse(row.evidence_json):(row.evidence_json??{});}catch{return[];}
    const ourValue=Number(evidence.ourValue),opponentValue=Number(evidence.opponentValue);
    if(!Number.isFinite(ourValue)||!Number.isFinite(opponentValue))return[];
    return [{
      matchId:row.match_id,
      side:row.side,
      metric:row.metric_code,
      direction:row.direction,
      magnitude:Number(row.magnitude),
      opportunities:row.opportunities==null?undefined:Number(row.opportunities),
      rankScore:Number(row.rank_score),
      ourValue,
      opponentValue,
      engineVersion:row.engine_version,
    } as StoredFinding];
  });
}

export async function getMatchSummary(matchId:string){
  const db=getAdminClient();
  const matchResult=await db.from('matches').select('*').eq('id',matchId).maybeSingle();assertNoError(matchResult.error,'Read match summary');
  const match=matchResult.data as any;if(!match)return null;
  const [teamResult,capResult,metrics,findingsResult,linksResult]=await Promise.all([
    match.opponent_team_id?db.from('teams').select('canonical_name').eq('id',match.opponent_team_id).maybeSingle():Promise.resolve({data:null,error:null} as any),
    db.from('match_capabilities').select('*').eq('match_id',matchId).maybeSingle(),
    getStoredMetrics(matchId),
    db.from('match_findings').select('side,metric_code,direction,magnitude,opportunities,rank_score,evidence_json').eq('match_id',matchId).eq('canonical_revision',match.canonical_revision).order('rank_score',{ascending:false}),
    db.from('match_source_links').select('source_artifact_id').eq('match_id',matchId),
  ]);
  assertNoError((teamResult as any).error,'Read summary opponent');assertNoError(capResult.error,'Read summary capabilities');assertNoError(findingsResult.error,'Read summary findings');assertNoError(linksResult.error,'Read summary source links');
  const c:any=capResult.data;
  const dataStatus=c?.contact_quality||c?.attack_destination?'Rich Data':c?.rally_sequence||c?.set_totals?'Standard Data':c?.box_score_totals?'Basic Data':'No Data Yet';
  const artifactIds=((linksResult.data??[]) as any[]).map(r=>r.source_artifact_id);
  const artifactsResult=artifactIds.length?await db.from('source_artifacts').select('source_family,original_filename,source_url,imported_at').in('id',artifactIds):{data:[],error:null};
  assertNoError((artifactsResult as any).error,'Read summary sources');
  const revision=Number(match.canonical_revision??1);
  const [canonicalRallies,setScoreIntegrity]=await Promise.all([loadCanonicalRallies(matchId,revision),loadRallyScoreIntegrity(matchId,revision)]);
  const conflictedSets=setScoreIntegrity.filter(row=>row.status==='conflict').map(row=>row.setNumber);
  const scoreIntegrity={
    status:conflictedSets.length?'conflict':setScoreIntegrity.length?'verified':'unknown',
    conflictedSets,
  } as const;
  const sideoutPathways={
    our_team:{first_ball_sideout:0,regular_sideout:0,unknown_phase:0},
    opponent:{first_ball_sideout:0,regular_sideout:0,unknown_phase:0},
  };
  if(scoreIntegrity.status!=='conflict')for(const rally of canonicalRallies){
    const side=rally.receivingSide;
    if(!side||rally.pointWinner!==side)continue;
    const key=rally.pathway==='first_ball_sideout'?'first_ball_sideout':rally.pathway==='regular_sideout'?'regular_sideout':'unknown_phase';
    sideoutPathways[side][key]+=1;
  }
  const rallyMetricCodes=new Set(['sideout_percentage','point_scored_percentage','score1_percentage','sos2_percentage','epo_percentage','longest_service_run']);
  const rallyMetrics=metrics.filter(metric=>rallyMetricCodes.has(metric.metric));
  const unsupported:string[]=[];
  if(scoreIntegrity.status==='conflict')unsupported.push('Rally analytics withheld because the source PBP conflicts with the official set score');
  if(!c?.offensive_phase)unsupported.push('FBSO and transition attack efficiency');
  if(!c?.transition_depth)unsupported.push('Transition depth (T1/T2/T3+)');
  if(!c?.contact_sequence)unsupported.push('Good Dig and contact-chain analytics');
  const serviceRuns=scoreIntegrity.status==='conflict'?[]:buildServiceRuns(canonicalRallies).map(run=>({teamSide:run.teamSide,setNumber:run.setNumber,pointsWon:run.pointsWon,serveAttempts:run.serveAttempts,...(run.serverSourceKey?{serverSourceKey:run.serverSourceKey}:{})}));
  const rallyAnalytics={metrics:rallyMetrics,sideoutPathways,unsupported,serviceRuns,scoreIntegrity};
  return {id:match.id,scheduledAt:match.scheduled_at,homeAway:match.home_away,location:match.location,result:match.result,setScoresJson:match.set_scores_json,canonicalRevision:match.canonical_revision,opponentName:(teamResult as any).data?.canonical_name??'Opponent',dataStatus,metrics,findings:((findingsResult.data??[]) as any[]).map(f=>({side:f.side,metric:f.metric_code,direction:f.direction,magnitude:f.magnitude,opportunities:f.opportunities,rankScore:f.rank_score,evidenceJson:f.evidence_json})),rallyAnalytics,sources:((artifactsResult as any).data??[]).map((s:any)=>({sourceFamily:s.source_family,fileName:s.original_filename,sourceUrl:s.source_url,importedAt:s.imported_at}))};
}
