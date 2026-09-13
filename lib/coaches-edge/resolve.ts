import type { MetricCode, StructuredAnalyticsQuery } from './types.js';

export type ResolverContext = { matchId: string; opponentNames?: string[] };
export type UnsupportedReasonCode = 'prescriptive' | 'requires_rotation' | 'unsupported_query';
export type ResolverResult =
  | { status: 'resolved'; query: StructuredAnalyticsQuery }
  | { status: 'unsupported'; reasonCode: UnsupportedReasonCode; reason: string };

const prescriptive = /\b(start|bench|sit|serve\s+target|who\s+should\s+serve|blocking\s+scheme|offensive\s+system)\b/i;
const rotationQuestion = /\b(rotation|rotations|r[1-6])\b/i;
const comparisonLanguage = /\b(compare|versus|vs\.?|against|more|fewer|less|higher|lower|difference|better|worse)\b/i;
const ourLanguage = /\b(we|our|ours|us)\b/i;
const opponentLanguage = /\b(opponent|they|them|their)\b/i;
const opponentStopWords = new Set(['state', 'university', 'college', 'the', 'and', 'women', 'womens', 'volleyball']);

function metricFromQuestion(text: string): MetricCode | null {
  if (/\b(service|serving|serve)\s+errors?\b/i.test(text)) return 'service_errors';
  if (/\b(attack|hitting)\s+errors?\b/i.test(text)) return 'attack_errors';
  if (/\battack\s+attempts?\b|\bswings?\b/i.test(text)) return 'attack_attempts';
  if (/\baces?\b/i.test(text)) return 'aces';
  if (/\bkills?\b/i.test(text)) return 'kills';
  if (/\b(hit|hitting|attack percentage|hitting percentage)\b/i.test(text)) return 'hitting_percentage';
  return null;
}

function opponentMentioned(text: string, opponentNames: string[]): boolean {
  if (opponentLanguage.test(text)) return true;
  const normalized = text.toLowerCase();
  return opponentNames.some((name) => {
    const usefulTokens = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !opponentStopWords.has(token));
    return usefulTokens.some((token) => new RegExp(`\\b${token}\\b`, 'i').test(normalized));
  });
}

function subjectsFromQuestion(text: string, context: ResolverContext): ('our_team' | 'opponent')[] {
  const ourMentioned = ourLanguage.test(text);
  const opponentIsMentioned = opponentMentioned(text, context.opponentNames ?? []);
  if (comparisonLanguage.test(text) || (ourMentioned && opponentIsMentioned)) return ['our_team', 'opponent'];
  if (opponentIsMentioned && !ourMentioned) return ['opponent'];
  return ['our_team'];
}

export function resolveCoachQuestion(text: string, context: ResolverContext): ResolverResult {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return { status: 'unsupported', reasonCode: 'unsupported_query', reason: 'Coach’s Edge does not support that question type yet.' };
  }
  if (prescriptive.test(normalized)) {
    return {
      status: 'unsupported',
      reasonCode: 'prescriptive',
      reason: 'Coach’s Edge explains evidence but does not make personnel or tactical prescriptions.',
    };
  }
  if (rotationQuestion.test(normalized)) {
    return { status: 'unsupported', reasonCode: 'requires_rotation', reason: 'rotation' };
  }

  const metric = metricFromQuestion(normalized);
  if (metric) {
    return {
      status: 'resolved',
      query: {
        intent: 'compare_metric',
        scope: { matchId: context.matchId },
        metric,
        subjects: subjectsFromQuestion(normalized, context),
      },
    };
  }

  if (/\b(match|summary|overall)\b/.test(normalized)) {
    return { status: 'resolved', query: { intent: 'match_summary', scope: { matchId: context.matchId } } };
  }

  return {
    status: 'unsupported',
    reasonCode: 'unsupported_query',
    reason: 'Coach’s Edge does not support that question type yet.',
  };
}
