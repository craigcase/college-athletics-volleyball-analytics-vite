import type { StoredFinding, StoredMetric, StructuredAnalyticsQuery } from './types.js';

export type QueryAnswer =
  | { status: 'answered'; scope: { matchId: string }; evidence: StoredMetric[]; numbers: number[]; finding?: StoredFinding }
  | { status: 'insufficient_evidence'; scope: { matchId: string }; evidence: StoredMetric[]; numbers: []; finding?: undefined };

export function executeAnalyticsQuery(query: StructuredAnalyticsQuery, metrics: StoredMetric[], findings: StoredFinding[] = []): QueryAnswer {
  if ((query.intent === 'compare_metric' || query.intent === 'metric_finding_status') && query.metric && query.subjects) {
    const evidence = query.subjects.flatMap((subject) => {
      const found = metrics.find((m) => m.matchId === query.scope.matchId && m.subject === subject && m.metric === query.metric);
      return found ? [found] : [];
    });
    if (evidence.length !== query.subjects.length) return { status: 'insufficient_evidence', scope: query.scope, evidence, numbers: [] };
    return { status: 'answered', scope: query.scope, evidence, numbers: evidence.map((item) => item.value) };
  }

  if (query.intent === 'top_finding') {
    const candidates = findings
      .filter((finding) => finding.matchId === query.scope.matchId)
      .filter((finding) => query.findingSide === 'either' || !query.findingSide || finding.side === query.findingSide)
      .sort((a, b) => b.rankScore - a.rankScore);
    const finding = candidates[0];
    if (!finding) return { status: 'insufficient_evidence', scope: query.scope, evidence: [], numbers: [] };
    const evidence = metrics.filter((metric) => metric.matchId === query.scope.matchId && metric.metric === finding.metric && (metric.subject === 'our_team' || metric.subject === 'opponent'));
    return { status: 'answered', scope: query.scope, evidence, numbers: [finding.ourValue, finding.opponentValue], finding };
  }

  const evidence = metrics.filter((m) => m.matchId === query.scope.matchId);
  if (!evidence.length) return { status: 'insufficient_evidence', scope: query.scope, evidence: [], numbers: [] };
  return { status: 'answered', scope: query.scope, evidence, numbers: evidence.map((item) => item.value) };
}
