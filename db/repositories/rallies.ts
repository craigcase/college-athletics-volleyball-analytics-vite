import { getAdminClient } from '../client.js';
import { assertNoError } from '../supabase-utils';
import { nowIso } from '../../lib/ids';
import type { CanonicalRallyDraft, CanonicalTimelineDraft, SetScoreIntegrity, TeamSide, TerminalEvent } from '../../lib/ingestion/match/timeline-types';
import type { RotationObservation } from '../../lib/ingestion/match/rotation-state';

const rallyId = (matchId:string, revision:number, setNumber:number, rallyNumber:number) =>
  `rally_${matchId}_${revision}_${setNumber}_${rallyNumber}`;

const asJson = (value:unknown) => value == null ? null : JSON.stringify(value);

export async function replaceCanonicalTimeline(input:{
  programId:string;
  matchId:string;
  sourceArtifactId:string;
  canonicalRevision:number;
  timeline:CanonicalTimelineDraft;
  rotations:RotationObservation[];
}):Promise<{rallyCount:number;placeholderCount:number}>{
  const db=getAdminClient();
  const now=nowIso();

  const existing=await db.from('match_rallies').select('id').eq('match_id',input.matchId).eq('canonical_revision',input.canonicalRevision);
  assertNoError(existing.error,'Read existing canonical rallies');
  const existingIds=((existing.data??[]) as any[]).map(row=>row.id);
  if(existingIds.length){
    for(const table of ['rally_phases','rally_events','rally_source_links','rally_rotation_states'] as const){
      const cleared=await db.from(table).delete().in('rally_id',existingIds);
      assertNoError(cleared.error,`Clear ${table}`);
    }
  }
  const clearTimeline=await db.from('match_timeline_events').delete().eq('match_id',input.matchId).eq('canonical_revision',input.canonicalRevision);
  assertNoError(clearTimeline.error,'Clear canonical timeline events');
  const clearRallies=await db.from('match_rallies').delete().eq('match_id',input.matchId).eq('canonical_revision',input.canonicalRevision);
  assertNoError(clearRallies.error,'Clear canonical rallies');

  if(input.timeline.setScoreIntegrity.length){
    const setRows=input.timeline.setScoreIntegrity.map(row=>({
      id:`set_${input.matchId}_${row.setNumber}`,
      match_id:input.matchId,
      set_number:row.setNumber,
      our_score:row.officialFinalScore.our,
      opponent_score:row.officialFinalScore.opponent,
      rally_score_status:row.status,
      source_final_score_json:JSON.stringify(row.sourceFinalScore),
      rally_canonical_revision:input.canonicalRevision,
      created_at:now,
    }));
    const setWrite=await db.from('match_sets').upsert(setRows,{onConflict:'match_id,set_number'});
    assertNoError(setWrite.error,'Persist canonical match sets');
  }

  if(input.timeline.rallies.length){
    const rallyRows=input.timeline.rallies.map(rally=>({
      id:rallyId(input.matchId,input.canonicalRevision,rally.setNumber,rally.rallyNumber),
      program_id:input.programId,
      match_id:input.matchId,
      set_number:rally.setNumber,
      rally_number:rally.rallyNumber,
      canonical_revision:input.canonicalRevision,
      score_before_our:rally.scoreBefore.our,
      score_before_opponent:rally.scoreBefore.opponent,
      score_after_our:rally.scoreAfter.our,
      score_after_opponent:rally.scoreAfter.opponent,
      serving_side:rally.servingSide??null,
      receiving_side:rally.receivingSide??null,
      server_source_key:rally.serverSourceKey??null,
      point_winner:rally.pointWinner,
      terminal_event_type:rally.terminal?.type??null,
      terminal_player_source_key:rally.terminal?.playerSourceKey??null,
      pathway:rally.pathway,
      attribution:rally.attribution,
      evidence_status:rally.evidenceStatus,
      terminal_json:asJson(rally.terminal),
      created_at:now,
      updated_at:now,
    }));
    const inserted=await db.from('match_rallies').insert(rallyRows);
    assertNoError(inserted.error,'Persist canonical rallies');
  }

  const timelineRows=input.timeline.timelineEvents.map((event,index)=>({
    id:`timeline_${input.matchId}_${input.canonicalRevision}_${event.setNumber}_${event.sourceOrdinal}_${index}`,
    program_id:input.programId,
    match_id:input.matchId,
    set_number:event.setNumber,
    rally_number:null,
    canonical_revision:input.canonicalRevision,
    source_record_key:event.sourceKey,
    source_ordinal:event.sourceOrdinal,
    event_type:event.type,
    team_side:event.teamSide??null,
    details_json:JSON.stringify({rawText:event.rawText}),
    created_at:now,
  }));
  if(timelineRows.length){
    const inserted=await db.from('match_timeline_events').insert(timelineRows);
    assertNoError(inserted.error,'Persist timeline events');
  }

  const sourceRows=input.timeline.rallies.flatMap(rally=>rally.sourceLinks.map((link,index)=>({
    id:`rallysource_${input.matchId}_${input.canonicalRevision}_${rally.setNumber}_${rally.rallyNumber}_${index}`,
    rally_id:rallyId(input.matchId,input.canonicalRevision,rally.setNumber,rally.rallyNumber),
    source_artifact_id:input.sourceArtifactId,
    source_record_key:link.sourceKey,
    source_ordinal:link.sourceOrdinal,
    alignment_confidence:link.confidence,
    reconciliation_status:rally.evidenceStatus==='ambiguous'?'ambiguous':'aligned',
    source_score_json:JSON.stringify(rally.scoreAfter),
    created_at:now,
  })));
  if(sourceRows.length){
    const inserted=await db.from('rally_source_links').insert(sourceRows);
    assertNoError(inserted.error,'Persist rally source links');
  }

  const rotationRows=input.rotations.map((rotation,index)=>({
    id:`rotation_${input.matchId}_${input.canonicalRevision}_${rotation.setNumber}_${rotation.rallyNumber}_${rotation.teamSide}_${index}`,
    rally_id:rallyId(input.matchId,input.canonicalRevision,rotation.setNumber,rotation.rallyNumber),
    team_side:rotation.teamSide,
    cycle_slot:rotation.cycleSlot??null,
    rotation_number:rotation.rotationNumber??null,
    method:rotation.method,
    confidence:rotation.confidence,
    server_source_key:rotation.serverSourceKey??null,
    derivation_version:'rotation-1.0.0',
    evidence_json:JSON.stringify({setNumber:rotation.setNumber,rallyNumber:rotation.rallyNumber}),
    created_at:now,
  }));
  if(rotationRows.length){
    const inserted=await db.from('rally_rotation_states').insert(rotationRows);
    assertNoError(inserted.error,'Persist rally rotation states');
  }

  return {
    rallyCount:input.timeline.rallies.length,
    placeholderCount:input.timeline.rallies.filter(r=>r.evidenceStatus!=='supported').length,
  };
}

export async function loadCanonicalRallies(matchId:string,canonicalRevision:number):Promise<CanonicalRallyDraft[]>{
  const db=getAdminClient();
  const result=await db.from('match_rallies').select('*').eq('match_id',matchId).eq('canonical_revision',canonicalRevision).order('set_number',{ascending:true}).order('rally_number',{ascending:true});
  assertNoError(result.error,'Load canonical rallies');
  return ((result.data??[]) as any[]).map(row=>{
    let terminal:TerminalEvent|undefined;
    if(row.terminal_json){
      try{ terminal=typeof row.terminal_json==='string'?JSON.parse(row.terminal_json):row.terminal_json; }catch{ terminal=undefined; }
    }
    return {
      setNumber:Number(row.set_number),
      rallyNumber:Number(row.rally_number),
      scoreBefore:{our:Number(row.score_before_our),opponent:Number(row.score_before_opponent)},
      scoreAfter:{our:Number(row.score_after_our),opponent:Number(row.score_after_opponent)},
      ...(row.serving_side?{servingSide:row.serving_side as TeamSide}:{}),
      ...(row.receiving_side?{receivingSide:row.receiving_side as TeamSide}:{}),
      ...(row.server_source_key?{serverSourceKey:String(row.server_source_key)}:{}),
      pointWinner:row.point_winner as TeamSide,
      ...(terminal?{terminal}:{}),
      pathway:row.pathway,
      attribution:row.attribution,
      evidenceStatus:row.evidence_status,
      sourceLinks:[],
    } as CanonicalRallyDraft;
  });
}


export async function loadRallyScoreIntegrity(matchId:string,canonicalRevision:number):Promise<SetScoreIntegrity[]> {
  const db=getAdminClient();
  const result=await db.from('match_sets')
    .select('set_number,our_score,opponent_score,rally_score_status,source_final_score_json,rally_canonical_revision')
    .eq('match_id',matchId)
    .eq('rally_canonical_revision',canonicalRevision)
    .order('set_number',{ascending:true});
  assertNoError(result.error,'Load rally score integrity');
  return ((result.data??[]) as any[]).flatMap(row=>{
    if(row.rally_score_status!=='verified'&&row.rally_score_status!=='conflict')return[];
    let sourceFinalScore:{our:number;opponent:number}|undefined;
    try{
      const parsed=typeof row.source_final_score_json==='string'?JSON.parse(row.source_final_score_json):row.source_final_score_json;
      if(parsed&&Number.isFinite(Number(parsed.our))&&Number.isFinite(Number(parsed.opponent)))sourceFinalScore={our:Number(parsed.our),opponent:Number(parsed.opponent)};
    }catch{return[];}
    if(!sourceFinalScore)return[];
    return [{
      setNumber:Number(row.set_number),
      officialFinalScore:{our:Number(row.our_score),opponent:Number(row.opponent_score)},
      sourceFinalScore,
      status:row.rally_score_status,
    } as SetScoreIntegrity];
  });
}
