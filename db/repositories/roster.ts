import { getAdminClient } from '../client';
import { assertNoError, byId } from '../supabase-utils';
import { id, nowIso } from '../../lib/ids';
import type { RosterEvidence } from '../../lib/ingestion/roster/sidearm';

const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const isNumberName=(value:string)=>/^\d+$/.test(value.trim());
type PlayerRow={id:string;canonical_name:string;profile_url?:string|null};

export async function upsertRosterEvidence(input:{programId:string;seasonId:string;teamId:string;players:RosterEvidence[];sourceFamily:string;actorEmail:string;sourceArtifactId:string}){
  const db=getAdminClient(),now=nowIso();
  let created=0,updated=0,needsReview=0;

  for(const player of input.players){
    let playerId:string|undefined;
    let matchedPlayer:PlayerRow|undefined;

    if(player.sourcePlayerId){
      const aliasResult=await db.from('player_aliases').select('player_id').eq('source_external_id',player.sourcePlayerId).limit(1).maybeSingle();
      assertNoError(aliasResult.error,'Find player alias');
      const alias=aliasResult.data as any;
      if(alias?.player_id){
        const [pResult,sResult]=await Promise.all([
          db.from('players').select('id,canonical_name').eq('id',alias.player_id).maybeSingle(),
          db.from('player_seasons').select('profile_url').eq('player_id',alias.player_id).eq('program_id',input.programId).limit(1).maybeSingle(),
        ]);
        assertNoError(pResult.error,'Read aliased player');assertNoError(sResult.error,'Read aliased player season');
        if(pResult.data){const candidate:PlayerRow={...(pResult.data as any),profile_url:(sResult.data as any)?.profile_url??null};matchedPlayer=candidate;playerId=candidate.id;}
      }
    }

    if(!playerId&&player.number){
      const seasons=await db.from('player_seasons').select('id,player_id,profile_url').eq('program_id',input.programId).eq('season_id',input.seasonId).eq('jersey_number',player.number);
      assertNoError(seasons.error,'Find player by jersey number');
      const seasonRows=(seasons.data??[]) as any[];
      if(seasonRows.length){
        const playersResult=await db.from('players').select('id,canonical_name').in('id',seasonRows.map(row=>row.player_id));
        assertNoError(playersResult.error,'Read jersey candidates');
        const pMap=byId((playersResult.data??[]) as any[]);
        const repairable=seasonRows.flatMap(season=>{
          const candidate=pMap.get(season.player_id) as any;
          if(!candidate||!isNumberName(candidate.canonical_name))return [];
          const profileMatches=!!season.profile_url&&!!player.profileUrl&&season.profile_url===player.profileUrl;
          return candidate.canonical_name===player.number||profileMatches?[{...candidate,profile_url:season.profile_url}]:[];
        });
        if(repairable.length===1){const candidate=repairable[0] as PlayerRow;matchedPlayer=candidate;playerId=candidate.id;}
      }
    }

    if(!playerId){
      const seasons=await db.from('player_seasons').select('player_id').eq('program_id',input.programId);
      assertNoError(seasons.error,'Read program player seasons');
      const ids=[...new Set(((seasons.data??[]) as any[]).map(row=>row.player_id))];
      if(ids.length){
        const playersResult=await db.from('players').select('id,canonical_name').in('id',ids);
        assertNoError(playersResult.error,'Read program players');
        const matches=((playersResult.data??[]) as any[]).filter(row=>normalize(row.canonical_name)===normalize(player.name));
        if(matches.length===1){const candidate=matches[0] as PlayerRow;matchedPlayer=candidate;playerId=candidate.id;}
        else if(matches.length>1){
          needsReview++;
          const issue=await db.from('reconciliation_issues').insert({id:id('issue'),program_id:input.programId,issue_type:'ambiguous_player_identity',entity_type:'player',details_json:JSON.stringify({sourceName:player.name,candidates:matches.map(row=>row.id)}),status:'open',created_at:now});
          assertNoError(issue.error,'Create player identity issue');
          continue;
        }
      }
    }

    if(!playerId){
      playerId=id('player');created++;
      const createdPlayer=await db.from('players').insert({id:playerId,canonical_name:player.name,created_at:now});
      assertNoError(createdPlayer.error,'Create player');
      const alias=await db.from('player_aliases').insert({id:id('playeralias'),player_id:playerId,alias:player.name,source_family:input.sourceFamily,source_external_id:player.sourcePlayerId??null,created_at:now});
      assertNoError(alias.error,'Create player alias');
    }else{
      updated++;
      if(!matchedPlayer){
        const current=await db.from('players').select('id,canonical_name').eq('id',playerId).maybeSingle();assertNoError(current.error,'Read player');matchedPlayer=(current.data as any)??undefined;
      }
      if(matchedPlayer&&isNumberName(matchedPlayer.canonical_name)){
        const repair=await db.from('players').update({canonical_name:player.name}).eq('id',playerId);assertNoError(repair.error,'Repair player name');
      }
      const alias=await db.from('player_aliases').upsert({id:id('playeralias'),player_id:playerId,alias:player.name,source_family:input.sourceFamily,source_external_id:player.sourcePlayerId??null,created_at:now},{onConflict:'player_id,alias',ignoreDuplicates:true});
      assertNoError(alias.error,'Upsert player alias');
    }

    const seasonResult=await db.from('player_seasons').select('*').eq('player_id',playerId).eq('season_id',input.seasonId).maybeSingle();
    assertNoError(seasonResult.error,'Read player season');
    const season=seasonResult.data as any;
    const playerSeasonId=season?.id??id('playerseason');
    if(season){
      const overridesResult=await db.from('canonical_overrides').select('field_name').eq('program_id',input.programId).eq('entity_type','player_season').eq('entity_id',season.id);
      assertNoError(overridesResult.error,'Read player overrides');
      const protectedFields=new Set(((overridesResult.data??[]) as any[]).map(row=>row.field_name));
      const canonical=(field:string,column:string,value:string|undefined)=>protectedFields.has(field)||protectedFields.has(column)?season[column]??null:value??null;
      const updatedSeason=await db.from('player_seasons').update({
        jersey_number:canonical('number','jersey_number',player.number),official_position:canonical('officialPosition','official_position',player.officialPosition),
        class_year:canonical('classYear','class_year',player.classYear),height:canonical('height','height',player.height),hometown:canonical('hometown','hometown',player.hometown),
        previous_school:canonical('previousSchool','previous_school',player.previousSchool),profile_url:season.profile_url??canonical('profileUrl','profile_url',player.profileUrl),
        image_url:season.image_url??canonical('imageUrl','image_url',player.imageUrl),source_player_id:season.source_player_id??canonical('sourcePlayerId','source_player_id',player.sourcePlayerId),
      }).eq('id',season.id);
      assertNoError(updatedSeason.error,'Update player season');
    }else{
      const inserted=await db.from('player_seasons').insert({id:playerSeasonId,player_id:playerId,program_id:input.programId,season_id:input.seasonId,team_id:input.teamId,jersey_number:player.number??null,official_position:player.officialPosition??null,class_year:player.classYear??null,height:player.height??null,hometown:player.hometown??null,previous_school:player.previousSchool??null,profile_url:player.profileUrl??null,image_url:player.imageUrl??null,source_player_id:player.sourcePlayerId??null,active:true,created_at:now});
      assertNoError(inserted.error,'Create player season');
    }

    const fields={name:player.name,number:player.number,officialPosition:player.officialPosition,classYear:player.classYear,height:player.height,hometown:player.hometown,previousSchool:player.previousSchool,profileUrl:player.profileUrl,imageUrl:player.imageUrl,sourcePlayerId:player.sourcePlayerId};
    const existingObs=await db.from('evidence_observations').select('field_name').eq('source_artifact_id',input.sourceArtifactId).eq('entity_type','player_season').eq('entity_id',playerSeasonId);
    assertNoError(existingObs.error,'Read roster evidence observations');
    const existingFields=new Set(((existingObs.data??[]) as any[]).map(row=>row.field_name));
    const observations=Object.entries(fields).filter(([,value])=>value!==undefined).filter(([field])=>!existingFields.has(field)).map(([field,value])=>({id:id('observation'),program_id:input.programId,source_artifact_id:input.sourceArtifactId,entity_type:'player_season',entity_id:playerSeasonId,source_entity_key:player.sourcePlayerId??null,field_name:field,value_json:JSON.stringify(value),source_confidence:0.9,observed_at:now}));
    if(observations.length){const obsInsert=await db.from('evidence_observations').insert(observations);assertNoError(obsInsert.error,'Persist roster evidence observations');}
  }

  const activity=await db.from('activity_events').insert({id:id('activity'),program_id:input.programId,actor_email:input.actorEmail,action:'roster.imported',entity_type:'roster',details_json:JSON.stringify({created,updated,needsReview}),created_at:now});
  assertNoError(activity.error,'Create roster activity');
  return {created,updated,needsReview,total:input.players.length};
}

export async function listRoster(programId:string,seasonId:string){
  const db=getAdminClient();
  const seasons=await db.from('player_seasons').select('id,player_id,jersey_number,official_position,class_year,height,hometown,previous_school,image_url').eq('program_id',programId).eq('season_id',seasonId).eq('active',true);
  assertNoError(seasons.error,'List roster seasons');
  const rows=(seasons.data??[]) as any[];
  const ids=[...new Set(rows.map(row=>row.player_id))];
  const players=ids.length?await db.from('players').select('id,canonical_name').in('id',ids):{data:[],error:null};
  assertNoError((players as any).error,'List roster players');
  const pMap=byId((((players as any).data??[]) as any[]));
  return rows.map(row=>({id:row.player_id,name:(pMap.get(row.player_id) as any)?.canonical_name??'Unknown player',number:row.jersey_number,officialPosition:row.official_position,classYear:row.class_year,height:row.height,hometown:row.hometown,previousSchool:row.previous_school,imageUrl:row.image_url})).sort((a,b)=>{
    const an=/^\d+$/.test(a.number??'')?Number(a.number):999,bn=/^\d+$/.test(b.number??'')?Number(b.number):999;
    return an-bn||a.name.localeCompare(b.name);
  });
}
