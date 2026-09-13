import type { MetricCode, StoredFinding, StructuredAnalyticsQuery } from './types.js';
import type { UnsupportedReasonCode } from './resolve.js';

const metricNames: Record<Exclude<MetricCode, 'hitting_percentage'>, { singular: string; plural: string }> = {
  kills: { singular: 'kill', plural: 'kills' },
  attack_errors: { singular: 'attack error', plural: 'attack errors' },
  attack_attempts: { singular: 'attack attempt', plural: 'attack attempts' },
  aces: { singular: 'ace', plural: 'aces' },
  service_errors: { singular: 'service error', plural: 'service errors' },
};

const findingLabels: Record<MetricCode, string> = {
  hitting_percentage: 'hitting percentage',
  kills: 'kills',
  attack_errors: 'attack errors',
  attack_attempts: 'attack attempts',
  aces: 'aces',
  service_errors: 'service errors',
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
      if (query.comparison === 'more') {
        return ourValue === opponentValue
          ? `We and ${opponentName} hit the same, ${formatMetricValue(query.metric, ourValue)}.`
          : ourValue > opponentValue
            ? `We hit higher, ${formatMetricValue(query.metric, ourValue)} to ${formatMetricValue(query.metric, opponentValue)}.`
            : `${opponentName} hit higher, ${formatMetricValue(query.metric, opponentValue)} to our ${formatMetricValue(query.metric, ourValue)}.`;
      }
      if (query.comparison === 'fewer') {
        return ourValue === opponentValue
          ? `We and ${opponentName} hit the same, ${formatMetricValue(query.metric, ourValue)}.`
          : ourValue < opponentValue
            ? `We hit lower, ${formatMetricValue(query.metric, ourValue)} to ${formatMetricValue(query.metric, opponentValue)}.`
            : `${opponentName} hit lower, ${formatMetricValue(query.metric, opponentValue)} to our ${formatMetricValue(query.metric, ourValue)}.`;
      }
      return `We hit ${formatMetricValue(query.metric, ourValue)}; ${opponentName} hit ${formatMetricValue(query.metric, opponentValue)}.`;
    }
    if (ourValue != null) return `We hit ${formatMetricValue(query.metric, ourValue)}.`;
    if (opponentValue != null) return `${opponentName} hit ${formatMetricValue(query.metric, opponentValue)}.`;
  }

  const metric = query.metric as Exclude<MetricCode, 'hitting_percentage'>;
  if (ourValue != null && opponentValue != null) {
    if (query.comparison === 'more') {
      if (ourValue === opponentValue) return `We and ${opponentName} had the same number of ${metricNames[metric].plural}: ${formatMetricValue(metric, ourValue)}.`;
      return ourValue > opponentValue
        ? `We had more ${metricNames[metric].plural}, ${formatMetricValue(metric, ourValue)} to ${opponentName}'s ${formatMetricValue(metric, opponentValue)}.`
        : `${opponentName} had more ${metricNames[metric].plural}, ${formatMetricValue(metric, opponentValue)} to our ${formatMetricValue(metric, ourValue)}.`;
    }
    if (query.comparison === 'fewer') {
      if (ourValue === opponentValue) return `We and ${opponentName} had the same number of ${metricNames[metric].plural}: ${formatMetricValue(metric, ourValue)}.`;
      return ourValue < opponentValue
        ? `We had fewer ${metricNames[metric].plural}, ${formatMetricValue(metric, ourValue)} to ${opponentName}'s ${formatMetricValue(metric, opponentValue)}.`
        : `${opponentName} had fewer ${metricNames[metric].plural}, ${formatMetricValue(metric, opponentValue)} to our ${formatMetricValue(metric, ourValue)}.`;
    }
    return `We had ${formatMetricValue(metric, ourValue)} ${countLabel(metric, ourValue)}; ${opponentName} had ${formatMetricValue(metric, opponentValue)}.`;
  }
  if (ourValue != null) return `We had ${formatMetricValue(metric, ourValue)} ${countLabel(metric, ourValue)}.`;
  if (opponentValue != null) return `${opponentName} had ${formatMetricValue(metric, opponentValue)} ${countLabel(metric, opponentValue)}.`;
  return 'Stored match evidence is available.';
}

export function formatFindingAnswer(finding: StoredFinding, opponentName: string): string {
  const ourValue = formatMetricValue(finding.metric, finding.ourValue);
  const opponentValue = formatMetricValue(finding.metric, finding.opponentValue);
  const magnitude = formatMetricValue(finding.metric, finding.magnitude);
  const label = findingLabels[finding.metric];
  const magnitudeLabel = finding.metric === 'hitting_percentage' ? `${magnitude} difference` : `${magnitude}-${metricNames[finding.metric as Exclude<MetricCode, 'hitting_percentage'>]?.singular ?? label} advantage`;
  if (finding.side === 'our_team') {
    return `Our strongest promoted statistical edge was ${label}: ${ourValue} to ${opponentValue}, a ${magnitudeLabel}.`;
  }
  return `${opponentName}'s strongest promoted statistical edge was ${label}: ${opponentValue} to our ${ourValue}, a ${magnitudeLabel}.`;
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
  if (query.intent === 'top_finding') {
    return 'No stored finding clears the evidence threshold for that question. I won’t fill the answer with a weaker conclusion.';
  }
  if (query.intent === 'compare_metric' && query.metric) {
    const label = query.metric === 'hitting_percentage'
      ? 'hitting-percentage'
      : metricNames[query.metric].singular;
    return `The current evidence doesn’t include enough ${label} data to answer that question.`;
  }
  return 'The current evidence does not support that answer yet.';
}
