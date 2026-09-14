import type { EvidenceEnvelope } from '../ingestion/types.js';

export type MatchCapabilities = {
  boxScoreTotals: boolean;
  playerTotals: boolean;
  setTotals: boolean;
  rallySequence: boolean;
  serveReceiveState: boolean;
  rotationState: boolean;
  onCourtState: boolean;
  contactQuality: boolean;
  attackOrigin: boolean;
  attackDestination: boolean;
  terminalEventDetail: boolean;
  timeoutTimeline: boolean;
  substitutionTimeline: boolean;
  offensivePhase: boolean;
  transitionDepth: boolean;
  contactSequence: boolean;
  timestamps: boolean;
};

export type RallyCapabilityFacts = {
  rallyCount: number;
  knownServeStateCount: number;
  terminalDetailCount: number;
  timeoutCount: number;
  substitutionCount: number;
  phaseCount: number;
  transitionDepthCount: number;
  contactCount: number;
  timestampCount: number;
};

export function detectCapabilities(input:{evidence:EvidenceEnvelope;rallyFacts?:RallyCapabilityFacts}): MatchCapabilities {
  const evidence=input.evidence;
  const facts=input.rallyFacts;
  const fields = new Set(evidence.observations.map((o) => o.field));
  const teamFields = new Set(evidence.observations.filter((o) => o.entityType === 'team').map((o) => o.field));
  return {
    boxScoreTotals: teamFields.has('kills') && teamFields.has('attack_errors') && teamFields.has('attack_attempts'),
    playerTotals: evidence.observations.some((o) => o.entityType === 'player'),
    setTotals: evidence.observations.some((o) => o.setNumber != null),
    rallySequence: Boolean((facts?.rallyCount??0)>0) || evidence.observations.some((o) => o.entityType === 'rally' || o.rallyIndex != null || o.field === 'score_after'),
    serveReceiveState: Boolean((facts?.knownServeStateCount??0)>0) || fields.has('serve_receive_state') || fields.has('serving_team'),
    rotationState: fields.has('rotation'),
    onCourtState: fields.has('on_court'),
    contactQuality: fields.has('pass_quality') || fields.has('dig_quality') || fields.has('set_quality'),
    attackOrigin: fields.has('attack_origin'),
    attackDestination: fields.has('attack_destination'),
    terminalEventDetail: Boolean((facts?.terminalDetailCount??0)>0),
    timeoutTimeline: Boolean((facts?.timeoutCount??0)>0),
    substitutionTimeline: Boolean((facts?.substitutionCount??0)>0),
    offensivePhase: Boolean((facts?.phaseCount??0)>0),
    transitionDepth: Boolean((facts?.transitionDepthCount??0)>0),
    contactSequence: Boolean((facts?.contactCount??0)>0),
    timestamps: Boolean((facts?.timestampCount??0)>0),
  };
}
