import type { StoredMetric, StructuredAnalyticsQuery } from './types.js';

export type QueryAnswer =
  | { status: 'answered'; scope: { matchId: string }; evidence: StoredMetric[]; numbers: number[] }
  | { status: 'insufficient_evidence'; scope: { matchId: string }; evidence: StoredMetric[]; numbers: [] };

export function executeAnalyticsQuery(query: StructuredAnalyticsQuery, metrics: StoredMetric[]): QueryAnswer {
  if (query.intent === 'compare_metric' && query.metric && query.subjects) {
    const evidence = query.subjects.flatMap((subject) => {
      const found = metrics.find((m) => m.matchId === query.scope.matchId && m.subject === subject && m.metric === query.metric);
      return found ? [found] : [];
    });
    if (evidence.length !== query.subjects.length) return { status: 'insufficient_evidence', scope: query.scope, evidence, numbers: [] };
    return { status: 'answered', scope: query.scope, evidence, numbers: evidence.map((item) => item.value) };
  }
  const evidence = metrics.filter((m) => m.matchId === query.scope.matchId);
  if (!evidence.length) return { status: 'insufficient_evidence', scope: query.scope, evidence: [], numbers: [] };
  return { status: 'answered', scope: query.scope, evidence, numbers: evidence.map((item) => item.value) };
}
