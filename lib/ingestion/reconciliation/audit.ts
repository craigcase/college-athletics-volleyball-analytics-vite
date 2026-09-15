import type { EvidenceObservation } from '../types.js';
import type { CanonicalRallyDraft, CanonicalTimelineDraft, TeamSide, TerminalEvent, TerminalEventType } from '../match/timeline-types.js';
import { terminalAttribution } from '../match/vbgame/common.js';

type TrackedField = 'kills' | 'aces' | 'service_errors' | 'attack_errors';
type TeamKey = 'us' | 'opponent';
type CountKey = `${TeamKey}:${TrackedField}`;

type Candidate = { type: TerminalEventType | 'unknown'; teamSide?: TeamSide; contribution: Partial<Record<CountKey, number>> };

export type ReconciliationFinding = {
  setNumber: number;
  rallyNumber: number;
  status: 'directly_verified' | 'uniquely_reconciled' | 'unresolved';
  terminalType?: TerminalEventType;
  playerSourceKey?: string;
  possibleTerminalTypes: string[];
  reason: string;
};

export type TimelineAuditResult = {
  timeline: CanonicalTimelineDraft;
  findings: ReconciliationFinding[];
  directlyVerifiedCount: number;
  reconciledCount: number;
  unresolvedCount: number;
};

const opposite = (side: TeamSide): TeamSide => side === 'our_team' ? 'opponent' : 'our_team';
const teamKey = (side: TeamSide): TeamKey => side === 'our_team' ? 'us' : 'opponent';
const countKey = (side: TeamSide, field: TrackedField): CountKey => `${teamKey(side)}:${field}`;

function teamTotals(observations: EvidenceObservation[]): Partial<Record<CountKey, number>> {
  const totals: Partial<Record<CountKey, number>> = {};
  for (const observation of observations) {
    if (observation.entityType !== 'team' || (observation.entityKey !== 'us' && observation.entityKey !== 'opponent')) continue;
    if (!['kills','aces','service_errors','attack_errors'].includes(observation.field)) continue;
    if (typeof observation.value !== 'number' || !Number.isFinite(observation.value)) continue;
    totals[`${observation.entityKey}:${observation.field}` as CountKey] = observation.value;
  }
  return totals;
}

function addContribution(target: Partial<Record<CountKey, number>>, terminal: TerminalEvent | undefined, pointWinner: TeamSide) {
  if (!terminal?.teamSide) return;
  if (terminal.type === 'kill') target[countKey(terminal.teamSide, 'kills')] = (target[countKey(terminal.teamSide, 'kills')] ?? 0) + 1;
  else if (terminal.type === 'service_ace') target[countKey(terminal.teamSide, 'aces')] = (target[countKey(terminal.teamSide, 'aces')] ?? 0) + 1;
  else if (terminal.type === 'service_error') target[countKey(terminal.teamSide, 'service_errors')] = (target[countKey(terminal.teamSide, 'service_errors')] ?? 0) + 1;
  else if (terminal.type === 'attack_error') target[countKey(terminal.teamSide, 'attack_errors')] = (target[countKey(terminal.teamSide, 'attack_errors')] ?? 0) + 1;
  else if (terminal.type === 'stuff_block') {
    const losingSide = opposite(pointWinner);
    target[countKey(losingSide, 'attack_errors')] = (target[countKey(losingSide, 'attack_errors')] ?? 0) + 1;
  }
}

function candidatesFor(rally: CanonicalRallyDraft): Candidate[] {
  const winner = rally.pointWinner;
  const loser = opposite(winner);
  const candidates: Candidate[] = [
    { type: 'kill', teamSide: winner, contribution: { [countKey(winner,'kills')]: 1 } },
    { type: 'attack_error', teamSide: loser, contribution: { [countKey(loser,'attack_errors')]: 1 } },
    { type: 'stuff_block', teamSide: winner, contribution: { [countKey(loser,'attack_errors')]: 1 } },
    { type: 'unknown', contribution: {} },
  ];
  if (rally.servingSide === winner) candidates.push({ type: 'service_ace', teamSide: winner, contribution: { [countKey(winner,'aces')]: 1 } });
  if (rally.servingSide && rally.servingSide !== winner) candidates.push({ type: 'service_error', teamSide: rally.servingSide, contribution: { [countKey(rally.servingSide,'service_errors')]: 1 } });
  return candidates;
}

function fitsUpperBounds(current: Partial<Record<CountKey, number>>, totals: Partial<Record<CountKey, number>>) {
  return Object.entries(totals).every(([key,total]) => (current[key as CountKey] ?? 0) <= Number(total));
}

function exactlyMatches(current: Partial<Record<CountKey, number>>, totals: Partial<Record<CountKey, number>>) {
  return Object.entries(totals).every(([key,total]) => (current[key as CountKey] ?? 0) === Number(total));
}

function playerForUniqueDeficit(input:{observations:EvidenceObservation[];timeline:CanonicalTimelineDraft;side:TeamSide;field:TrackedField}):string|undefined {
  const prefix=`${teamKey(input.side)}:player:`;
  const official = new Map<string,number>();
  for(const observation of input.observations){
    if(observation.entityType==='player' && observation.entityKey.startsWith(prefix) && observation.field===input.field && typeof observation.value==='number'){
      official.set(observation.entityKey.slice(prefix.length), observation.value);
    }
  }
  if(!official.size)return undefined;
  const observed=new Map<string,number>();
  for(const rally of input.timeline.rallies){
    const terminal=rally.terminal;
    if(!terminal?.playerSourceKey || terminal.teamSide!==input.side)continue;
    const matches=(input.field==='kills'&&terminal.type==='kill')||(input.field==='aces'&&terminal.type==='service_ace')||(input.field==='service_errors'&&terminal.type==='service_error')||(input.field==='attack_errors'&&terminal.type==='attack_error');
    if(matches)observed.set(terminal.playerSourceKey,(observed.get(terminal.playerSourceKey)??0)+1);
  }
  const deficits=[...official.entries()].map(([player,total])=>[player,total-(observed.get(player)??0)] as const).filter(([,deficit])=>deficit>0);
  return deficits.length===1 && deficits[0][1]===1 ? deficits[0][0] : undefined;
}

function terminalFromCandidate(candidate:Candidate,rally:CanonicalRallyDraft,playerSourceKey?:string):TerminalEvent|undefined {
  if(candidate.type==='unknown')return undefined;
  return {
    type:candidate.type,
    ...(candidate.teamSide?{teamSide:candidate.teamSide}:{}),
    ...(playerSourceKey?{playerSourceKey}:{}),
    rawText:'Uniquely reconciled from official box-score totals.',
  };
}

function pathwayFor(rally:CanonicalRallyDraft,terminal:TerminalEvent|undefined):CanonicalRallyDraft['pathway'] {
  if(terminal?.type==='service_error' && rally.receivingSide===rally.pointWinner)return 'first_ball_sideout';
  if(terminal?.type==='service_ace' && rally.servingSide===rally.pointWinner)return 'direct_serve_point';
  if(rally.servingSide===rally.pointWinner)return 'transition_point';
  return 'unknown_phase';
}

export function auditTimelineAgainstTotals(input:{timeline:CanonicalTimelineDraft;observations:EvidenceObservation[]}):TimelineAuditResult {
  const timeline:CanonicalTimelineDraft={
    ...input.timeline,
    rallies:input.timeline.rallies.map(r=>({...r,scoreBefore:{...r.scoreBefore},scoreAfter:{...r.scoreAfter},sourceLinks:[...r.sourceLinks],...(r.terminal?{terminal:{...r.terminal}}:{})})),
    timelineEvents:[...input.timeline.timelineEvents],
    setScoreIntegrity:[...input.timeline.setScoreIntegrity],
  };
  const totals=teamTotals(input.observations);
  const current:Partial<Record<CountKey,number>>={};
  const unknownIndexes:number[]=[];
  timeline.rallies.forEach((rally,index)=>{
    if((rally.evidenceStatus==='gap_placeholder'||rally.evidenceStatus==='ambiguous') && !rally.terminal)unknownIndexes.push(index);
    else addContribution(current,rally.terminal,rally.pointWinner);
  });
  const findings:ReconciliationFinding[]=[];
  const directlyVerifiedCount=timeline.rallies.filter(r=>r.evidenceStatus==='supported').length;
  if(!unknownIndexes.length || !Object.keys(totals).length){
    for(const index of unknownIndexes){const rally=timeline.rallies[index];findings.push({setNumber:rally.setNumber,rallyNumber:rally.rallyNumber,status:'unresolved',possibleTerminalTypes:candidatesFor(rally).map(c=>c.type),reason:'No uniquely constraining official totals were available.'});}
    return {timeline,findings,directlyVerifiedCount,reconciledCount:0,unresolvedCount:unknownIndexes.length};
  }
  if(!fitsUpperBounds(current,totals) || unknownIndexes.length>6){
    for(const index of unknownIndexes){const rally=timeline.rallies[index];findings.push({setNumber:rally.setNumber,rallyNumber:rally.rallyNumber,status:'unresolved',possibleTerminalTypes:candidatesFor(rally).map(c=>c.type),reason:unknownIndexes.length>6?'Too many unresolved rallies for safe unique reconciliation.':'Explicit PBP already conflicts with official totals.'});}
    return {timeline,findings,directlyVerifiedCount,reconciledCount:0,unresolvedCount:unknownIndexes.length};
  }

  const solutions:Candidate[][]=[];
  const search=(position:number,counts:Partial<Record<CountKey,number>>,chosen:Candidate[])=>{
    if(solutions.length>2)return;
    if(position===unknownIndexes.length){if(exactlyMatches(counts,totals))solutions.push([...chosen]);return;}
    const rally=timeline.rallies[unknownIndexes[position]];
    for(const candidate of candidatesFor(rally)){
      const next={...counts};
      for(const [key,delta] of Object.entries(candidate.contribution))next[key as CountKey]=(next[key as CountKey]??0)+Number(delta);
      if(!fitsUpperBounds(next,totals))continue;
      chosen.push(candidate); search(position+1,next,chosen); chosen.pop();
      if(solutions.length>2)return;
    }
  };
  search(0,current,[]);

  const unique=solutions.length===1 && solutions[0].every(candidate=>candidate.type!=='unknown');
  if(unique){
    solutions[0].forEach((candidate,solutionIndex)=>{
      const rallyIndex=unknownIndexes[solutionIndex];
      const rally=timeline.rallies[rallyIndex];
      const field:TrackedField|undefined = candidate.type==='kill'?'kills':candidate.type==='service_ace'?'aces':candidate.type==='service_error'?'service_errors':candidate.type==='attack_error'?'attack_errors':undefined;
      const playerSourceKey=field&&candidate.teamSide?playerForUniqueDeficit({observations:input.observations,timeline,side:candidate.teamSide,field}):undefined;
      const terminal=terminalFromCandidate(candidate,rally,playerSourceKey);
      timeline.rallies[rallyIndex]={...rally,...(terminal?{terminal}:{}),pathway:pathwayFor(rally,terminal),attribution:terminalAttribution(terminal),evidenceStatus:'uniquely_reconciled'};
      findings.push({setNumber:rally.setNumber,rallyNumber:rally.rallyNumber,status:'uniquely_reconciled',terminalType:terminal?.type,...(playerSourceKey?{playerSourceKey}:{}),possibleTerminalTypes:[candidate.type],reason:'Official team/player totals leave exactly one supported terminal classification.'});
    });
    return {timeline,findings,directlyVerifiedCount,reconciledCount:unknownIndexes.length,unresolvedCount:0};
  }

  for(let solutionIndex=0;solutionIndex<unknownIndexes.length;solutionIndex+=1){
    const rally=timeline.rallies[unknownIndexes[solutionIndex]];
    const possible=solutions.length
      ? [...new Set(solutions.map(solution=>solution[solutionIndex]?.type).filter(Boolean))]
      : candidatesFor(rally).map(candidate=>candidate.type);
    findings.push({setNumber:rally.setNumber,rallyNumber:rally.rallyNumber,status:'unresolved',possibleTerminalTypes:possible,reason:solutions.length>1?'More than one terminal classification satisfies the official totals.':'No terminal classification can be proven from the available totals.'});
  }
  return {timeline,findings,directlyVerifiedCount,reconciledCount:0,unresolvedCount:unknownIndexes.length};
}
