export type EvidenceObservation = {
  entityType: 'team' | 'player' | 'match' | 'set' | 'rally';
  entityKey: string;
  field: string;
  value: string | number | boolean;
  setNumber?: number;
  rallyIndex?: number;
};

export type EvidenceEnvelope = {
  observations: EvidenceObservation[];
};
