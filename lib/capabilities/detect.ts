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
};

export function detectCapabilities(evidence: EvidenceEnvelope): MatchCapabilities {
  const fields = new Set(evidence.observations.map((o) => o.field));
  const teamFields = new Set(evidence.observations.filter((o) => o.entityType === 'team').map((o) => o.field));
  return {
    boxScoreTotals: teamFields.has('kills') && teamFields.has('attack_errors') && teamFields.has('attack_attempts'),
    playerTotals: evidence.observations.some((o) => o.entityType === 'player'),
    setTotals: evidence.observations.some((o) => o.setNumber != null),
    rallySequence: evidence.observations.some((o) => o.entityType === 'rally' || o.rallyIndex != null || o.field === 'score_after'),
    serveReceiveState: fields.has('serve_receive_state') || fields.has('serving_team'),
    rotationState: fields.has('rotation'),
    onCourtState: fields.has('on_court'),
    contactQuality: fields.has('pass_quality') || fields.has('dig_quality') || fields.has('set_quality'),
    attackOrigin: fields.has('attack_origin'),
    attackDestination: fields.has('attack_destination'),
  };
}
