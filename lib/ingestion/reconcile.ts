export type SourceObservation<T> = { value: T; sourceConfidence: number; lineageId: string };
export type StaffOverride<T> = { value: T; note?: string };
export type ReconcileResult<T> =
  | { status: 'resolved'; value: T; basis: 'staff_override' | 'source_confidence' | 'source_confidence_and_independent_agreement' }
  | { status: 'conflict'; values: T[] };

const keyOf = (value: unknown) => JSON.stringify(value);

export function reconcileField<T>(input: { observations: SourceObservation<T>[]; override?: StaffOverride<T> }): ReconcileResult<T> {
  if (input.override) return { status: 'resolved', value: input.override.value, basis: 'staff_override' };
  if (!input.observations.length) return { status: 'conflict', values: [] };
  const maxConfidence = Math.max(...input.observations.map((o) => o.sourceConfidence));
  const top = input.observations.filter((o) => o.sourceConfidence === maxConfidence);
  if (top.length === 1) return { status: 'resolved', value: top[0].value, basis: 'source_confidence' };

  const groups = new Map<string, { value: T; lineages: Set<string> }>();
  for (const observation of top) {
    const key = keyOf(observation.value);
    const group = groups.get(key) ?? { value: observation.value, lineages: new Set<string>() };
    group.lineages.add(observation.lineageId);
    groups.set(key, group);
  }
  const ranked = [...groups.values()].sort((a, b) => b.lineages.size - a.lineages.size);
  if (ranked.length === 1) return { status: 'resolved', value: ranked[0].value, basis: 'source_confidence_and_independent_agreement' };
  if (ranked[0].lineages.size > ranked[1].lineages.size) {
    return { status: 'resolved', value: ranked[0].value, basis: 'source_confidence_and_independent_agreement' };
  }
  return { status: 'conflict', values: ranked.filter((g) => g.lineages.size === ranked[0].lineages.size).map((g) => g.value) };
}
