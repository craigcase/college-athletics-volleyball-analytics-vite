import type { MetricCode, StructuredAnalyticsQuery } from './types.js';
import type { UnsupportedReasonCode } from './resolve.js';

const metricNames: Record<Exclude<MetricCode, 'hitting_percentage'>, { singular: string; plural: string }> = {
  kills: { singular: 'kill', plural: 'kills' },
  attack_errors: { singular: 'attack error', plural: 'attack errors' },
  attack_attempts: { singular: 'attack attempt', plural: 'attack attempts' },
  aces: { singular: 'ace', plural: 'aces' },
  service_errors: { singular: 'service error', plural: 'service errors' },
};

export function formatMetricValue(metric: MetricCode, value: number): string {
  if (metric === 'hitting_percentage') return value.toFixed(3).replace(/^(-?)0\./, '$1.');
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function countLabel(metric: Exclude<MetricCode, 'hitting_percentage'>, value: number): string {
  return Math.abs(value) === 1 ? metricNames[metric].singular : metricNames[metric].plural;
}

export function formatCoachAnswer(query: StructuredAnalyticsQuery, numbers: number[], opponentName: string): string {
  if (query.intent === 'match_summary') return 'Stored match evidence is available.';
  if (!query.metric || !query.subjects?.length || numbers.length !== query.subjects.length) {
    return 'Stored match evidence is available.';
  }

  const values = new Map(query.subjects.map((subject, index) => [subject, numbers[index]]));
  const ourValue = values.get('our_team');
  const opponentValue = values.get('opponent');

  if (query.metric === 'hitting_percentage') {
    if (ourValue != null && opponentValue != null) {
      return `We hit ${formatMetricValue(query.metric, ourValue)}; ${opponentName} hit ${formatMetricValue(query.metric, opponentValue)}.`;
    }
    if (ourValue != null) return `We hit ${formatMetricValue(query.metric, ourValue)}.`;
    if (opponentValue != null) return `${opponentName} hit ${formatMetricValue(query.metric, opponentValue)}.`;
  }

  const metric = query.metric as Exclude<MetricCode, 'hitting_percentage'>;
  if (ourValue != null && opponentValue != null) {
    return `We had ${formatMetricValue(metric, ourValue)} ${countLabel(metric, ourValue)}; ${opponentName} had ${formatMetricValue(metric, opponentValue)}.`;
  }
  if (ourValue != null) return `We had ${formatMetricValue(metric, ourValue)} ${countLabel(metric, ourValue)}.`;
  if (opponentValue != null) return `${opponentName} had ${formatMetricValue(metric, opponentValue)} ${countLabel(metric, opponentValue)}.`;
  return 'Stored match evidence is available.';
}

export function unsupportedQuestionMessage(
  reasonCode: UnsupportedReasonCode,
  capabilities: { rotationState: boolean } = { rotationState: false },
): string {
  if (reasonCode === 'prescriptive') {
    return 'Coach’s Edge explains evidence but does not make personnel or tactical prescriptions.';
  }
  if (reasonCode === 'requires_rotation') {
    return capabilities.rotationState
      ? 'This match has rotation-by-rotation evidence, but Coach’s Edge does not support rotation questions yet.'
      : 'The current evidence doesn’t include rotation-by-rotation data, so I can’t answer that question for this match.';
  }
  return 'Coach’s Edge does not support that question type yet.';
}

export function insufficientEvidenceMessage(query: StructuredAnalyticsQuery): string {
  if (query.intent === 'compare_metric' && query.metric) {
    const label = query.metric === 'hitting_percentage'
      ? 'hitting-percentage'
      : metricNames[query.metric].singular;
    return `The current evidence doesn’t include enough ${label} data to answer that question.`;
  }
  return 'The current evidence does not support that answer yet.';
}
