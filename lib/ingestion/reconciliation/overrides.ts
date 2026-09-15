import type { CanonicalRallyDraft, PointAttribution, RallyPathway, TeamSide, TerminalEvent, TerminalEventType } from '../match/timeline-types.js';
import { terminalAttribution } from '../match/vbgame/common.js';

export type RallyOverrideField='terminal_event_type'|'terminal_player_source_key'|'pathway'|'attribution';
export type ActiveRallyOverride={entityId:string;fieldName:RallyOverrideField;value:unknown};

const opposite=(side:TeamSide):TeamSide=>side==='our_team'?'opponent':'our_team';

function terminalTeamSide(type:TerminalEventType,rally:CanonicalRallyDraft):TeamSide|undefined{
  if(type==='kill'||type==='service_ace'||type==='stuff_block'||type==='penalty_point')return rally.pointWinner;
  if(type==='service_error')return rally.servingSide;
  if(type==='attack_error'||type==='setting_error'||type==='ball_handling_error'||type==='blocking_error')return opposite(rally.pointWinner);
  return undefined;
}

function pathwayFromTerminal(rally:CanonicalRallyDraft,terminal?:TerminalEvent):RallyPathway{
  if(terminal?.type==='service_error'&&rally.receivingSide===rally.pointWinner)return 'first_ball_sideout';
  if(terminal?.type==='service_ace'&&rally.servingSide===rally.pointWinner)return 'direct_serve_point';
  if(rally.servingSide===rally.pointWinner)return 'transition_point';
  return 'unknown_phase';
}

export function applyRallyOverrides(rallies:CanonicalRallyDraft[],overrides:ActiveRallyOverride[],matchId:string):CanonicalRallyDraft[]{
  const grouped=new Map<string,ActiveRallyOverride[]>();
  for(const override of overrides){const rows=grouped.get(override.entityId)??[];rows.push(override);grouped.set(override.entityId,rows);}
  return rallies.map(source=>{
    const entityId=`${matchId}:${source.setNumber}:${source.rallyNumber}`;
    const rows=grouped.get(entityId);
    if(!rows?.length)return source;
    let rally:CanonicalRallyDraft={...source,...(source.terminal?{terminal:{...source.terminal}}:{}),sourceLinks:[...source.sourceLinks]};
    let terminal=rally.terminal;
    const typeOverride=rows.find(row=>row.fieldName==='terminal_event_type');
    if(typeOverride){
      const type=String(typeOverride.value) as TerminalEventType;
      if(type==='unknown')terminal=undefined;
      else terminal={...(terminal??{rawText:'Staff-confirmed correction.'}),type,teamSide:terminalTeamSide(type,rally),rawText:terminal?.rawText??'Staff-confirmed correction.'};
      rally={...rally,...(terminal?{terminal}:{terminal:undefined}),pathway:pathwayFromTerminal(rally,terminal),attribution:terminalAttribution(terminal),evidenceStatus:'staff_confirmed'};
    }
    const playerOverride=rows.find(row=>row.fieldName==='terminal_player_source_key');
    if(playerOverride&&terminal){
      const player=playerOverride.value==null?'':String(playerOverride.value).trim();
      terminal={...terminal,...(player?{playerSourceKey:player}:{playerSourceKey:undefined})};
      rally={...rally,terminal,evidenceStatus:'staff_confirmed'};
    }
    const pathwayOverride=rows.find(row=>row.fieldName==='pathway');
    if(pathwayOverride)rally={...rally,pathway:String(pathwayOverride.value) as RallyPathway,evidenceStatus:'staff_confirmed'};
    const attributionOverride=rows.find(row=>row.fieldName==='attribution');
    if(attributionOverride)rally={...rally,attribution:String(attributionOverride.value) as PointAttribution,evidenceStatus:'staff_confirmed'};
    return rally;
  });
}
