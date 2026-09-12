import type { StructuredAnalyticsQuery } from './types.js';

export type ResolverContext = { matchId: string; opponentNames: string[] };
export type ResolverResult = { status: 'resolved'; query: StructuredAnalyticsQuery } | { status: 'unsupported'; reason: string };

const prescriptive = /\b(start|bench|sit|serve\s+target|who\s+should\s+serve|blocking\s+scheme|offensive\s+system)\b/i;

export function resolveCoachQuestion(text: string, context: ResolverContext): ResolverResult {
  const normalized = text.trim().toLowerCase();
  if (!normalized || prescriptive.test(normalized)) return { status: 'unsupported', reason: 'Coach’s Edge explains evidence but does not make personnel or tactical prescriptions.' };
  if (/\b(hit|hitting|attack percentage|hitting percentage)\b/.test(normalized)) {
    return {
      status: 'resolved',
      query: {
        intent: 'compare_metric',
        scope: { matchId: context.matchId },
        metric: 'hitting_percentage',
        subjects: ['our_team', 'opponent'],
      },
    };
  }
  if (/\b(match|summary|overall)\b/.test(normalized)) {
    return { status: 'resolved', query: { intent: 'match_summary', scope: { matchId: context.matchId } } };
  }
  return { status: 'unsupported', reason: 'That question is outside the first deterministic query vocabulary.' };
}
