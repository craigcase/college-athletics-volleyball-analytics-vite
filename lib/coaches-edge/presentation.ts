import type { MetricCode, StoredFinding, StoredMetric, StructuredAnalyticsQuery } from './types.js';
import type { UnsupportedReasonCode } from './resolve.js';

const countMetrics={
  kills:{singular:'kill',plural:'kills'},attack_errors:{singular:'attack error',plural:'attack errors'},attack_attempts:{singular:'attack attempt',plural:'attack attempts'},aces:{singular:'ace',plural:'aces'},service_errors:{singular:'service error',plural:'service errors'},
} as const;
const percentageLabels:Partial<Record<MetricCode,string>>={sideout_percentage:'sideout percentage',point_scored_percentage:'point scored percentage',score1_percentage:'Score1',sos2_percentage:'SOS2',epo_percentage:'EPO'};
const findingLabels:Record<MetricCode,string>={hitting_percentage:'hitting percentage',kills:'kills',attack_errors:'attack errors',attack_attempts:'attack attempts',aces:'aces',service_errors:'service errors',sideout_percentage:'sideout percentage',point_scored_percentage:'point scored percentage',score1_percentage:'Score1',sos2_percentage:'SOS2',epo_percentage:'EPO',longest_service_run:'longest service run'};
const promotionThresholds:Partial<Record<MetricCode,number>>={hitting_percentage:.05,aces:2,service_errors:2,kills:4};

export function formatMetricValue(metric: MetricCode, value: number): string {
  if(metric==='hitting_percentage')return value.toFixed(3).replace(/^(-?)0\./,'$1.');
  if(metric in percentageLabels)return `${(value*100).toFixed(1)}%`;
  return Number.isInteger(value)?String(value):String(Number(value.toFixed(3)));
}
function countLabel(metric:keyof typeof countMetrics,value:number){return Math.abs(value)===1?countMetrics[metric].singular:countMetrics[metric].plural;}
function evidenceFor(evidence:StoredMetric[]|undefined,subject:'our_team'|'opponent',metric:MetricCode){return evidence?.find(row=>row.subject===subject&&row.metric===metric);}

export function formatCoachAnswer(query:StructuredAnalyticsQuery,numbers:number[],opponentName:string,evidence:StoredMetric[]=[]):string{
  if(query.intent==='match_summary')return 'Stored match evidence is available.';
  if(!query.metric||!query.subjects?.length||numbers.length!==query.subjects.length)return 'Stored match evidence is available.';
  const values=new Map(query.subjects.map((subject,index)=>[subject,numbers[index]]));
  const ourValue=values.get('our_team'),opponentValue=values.get('opponent');

  if(query.intent==='metric_finding_status'&&ourValue!=null&&opponentValue!=null){
    const threshold=promotionThresholds[query.metric];
    const magnitude=Math.abs(ourValue-opponentValue);
    if(query.metric==='hitting_percentage'&&threshold!=null){
      const relation=magnitude>=threshold?'meets or exceeds':'is below';
      const conclusion=magnitude>=threshold?'so it cleared the promotion threshold for a finding.':'so it was not one of the strongest promoted findings.';
      return `We hit ${formatMetricValue(query.metric,ourValue)} to ${opponentName}’s ${formatMetricValue(query.metric,opponentValue)}, a ${formatMetricValue(query.metric,magnitude)} advantage. That ${relation} the ${formatMetricValue(query.metric,threshold)} promotion threshold, ${conclusion}`;
    }
  }

  if(query.metric==='longest_service_run'){
    if(ourValue!=null&&opponentValue!=null)return `Our longest serving run was ${formatMetricValue(query.metric,ourValue)} points; ${opponentName}'s was ${formatMetricValue(query.metric,opponentValue)}.`;
    if(ourValue!=null)return `Our longest serving run was ${formatMetricValue(query.metric,ourValue)} points.`;
    if(opponentValue!=null)return `${opponentName}'s longest serving run was ${formatMetricValue(query.metric,opponentValue)} points.`;
  }

  if(query.metric in percentageLabels){
    if(ourValue!=null&&opponentValue==null){
      const row=evidenceFor(evidence,'our_team',query.metric);
      const pct=formatMetricValue(query.metric,ourValue);
      if(query.metric==='sos2_percentage'&&row?.numerator!=null&&row.opportunities!=null)return `We converted ${row.numerator} of ${row.opportunities} SOS2 opportunities (${pct}).`;
      if(query.metric==='score1_percentage'&&row?.numerator!=null&&row.opportunities!=null)return `We scored the first serving point after sideout on ${row.numerator} of ${row.opportunities} eligible opportunities (${pct}).`;
      if(row?.numerator!=null&&row.opportunities!=null)return `Our ${percentageLabels[query.metric]} was ${pct} (${row.numerator} of ${row.opportunities} opportunities).`;
      return `Our ${percentageLabels[query.metric]} was ${pct}.`;
    }
    if(opponentValue!=null&&ourValue==null){
      const row=evidenceFor(evidence,'opponent',query.metric);const pct=formatMetricValue(query.metric,opponentValue);
      return row?.numerator!=null&&row.opportunities!=null?`${opponentName}'s ${percentageLabels[query.metric]} was ${pct} (${row.numerator} of ${row.opportunities} opportunities).`:`${opponentName}'s ${percentageLabels[query.metric]} was ${pct}.`;
    }
    if(ourValue!=null&&opponentValue!=null)return `Our ${percentageLabels[query.metric]} was ${formatMetricValue(query.metric,ourValue)}; ${opponentName}'s was ${formatMetricValue(query.metric,opponentValue)}.`;
  }

  if(query.metric==='hitting_percentage'){
    if(ourValue!=null&&opponentValue!=null){
      if(query.comparison==='more')return ourValue===opponentValue?`We and ${opponentName} hit the same, ${formatMetricValue(query.metric,ourValue)}.`:ourValue>opponentValue?`We hit higher, ${formatMetricValue(query.metric,ourValue)} to ${formatMetricValue(query.metric,opponentValue)}.`:`${opponentName} hit higher, ${formatMetricValue(query.metric,opponentValue)} to our ${formatMetricValue(query.metric,ourValue)}.`;
      if(query.comparison==='fewer')return ourValue===opponentValue?`We and ${opponentName} hit the same, ${formatMetricValue(query.metric,ourValue)}.`:ourValue<opponentValue?`We hit lower, ${formatMetricValue(query.metric,ourValue)} to ${formatMetricValue(query.metric,opponentValue)}.`:`${opponentName} hit lower, ${formatMetricValue(query.metric,opponentValue)} to our ${formatMetricValue(query.metric,ourValue)}.`;
      return `We hit ${formatMetricValue(query.metric,ourValue)}; ${opponentName} hit ${formatMetricValue(query.metric,opponentValue)}.`;
    }
    if(ourValue!=null)return `We hit ${formatMetricValue(query.metric,ourValue)}.`;
    if(opponentValue!=null)return `${opponentName} hit ${formatMetricValue(query.metric,opponentValue)}.`;
  }

  const metric=query.metric as keyof typeof countMetrics;
  if(metric in countMetrics){
    if(ourValue!=null&&opponentValue!=null){
      if(query.comparison==='more'){
        if(ourValue===opponentValue)return `We and ${opponentName} had the same number of ${countMetrics[metric].plural}: ${formatMetricValue(metric,ourValue)}.`;
        return ourValue>opponentValue?`We had more ${countMetrics[metric].plural}, ${formatMetricValue(metric,ourValue)} to ${opponentName}'s ${formatMetricValue(metric,opponentValue)}.`:`${opponentName} had more ${countMetrics[metric].plural}, ${formatMetricValue(metric,opponentValue)} to our ${formatMetricValue(metric,ourValue)}.`;
      }
      if(query.comparison==='fewer'){
        if(ourValue===opponentValue)return `We and ${opponentName} had the same number of ${countMetrics[metric].plural}: ${formatMetricValue(metric,ourValue)}.`;
        return ourValue<opponentValue?`We had fewer ${countMetrics[metric].plural}, ${formatMetricValue(metric,ourValue)} to ${opponentName}'s ${formatMetricValue(metric,opponentValue)}.`:`${opponentName} had fewer ${countMetrics[metric].plural}, ${formatMetricValue(metric,opponentValue)} to our ${formatMetricValue(metric,ourValue)}.`;
      }
      return `We had ${formatMetricValue(metric,ourValue)} ${countLabel(metric,ourValue)}; ${opponentName} had ${formatMetricValue(metric,opponentValue)}.`;
    }
    if(ourValue!=null)return `We had ${formatMetricValue(metric,ourValue)} ${countLabel(metric,ourValue)}.`;
    if(opponentValue!=null)return `${opponentName} had ${formatMetricValue(metric,opponentValue)} ${countLabel(metric,opponentValue)}.`;
  }
  return 'Stored match evidence is available.';
}

export function formatFindingAnswer(finding:StoredFinding,opponentName:string):string{
  const ourValue=formatMetricValue(finding.metric,finding.ourValue),opponentValue=formatMetricValue(finding.metric,finding.opponentValue),magnitude=formatMetricValue(finding.metric,finding.magnitude),label=findingLabels[finding.metric];
  const countMetric=finding.metric as keyof typeof countMetrics;
  const magnitudeLabel=finding.metric==='hitting_percentage'?`${magnitude} difference`:countMetric in countMetrics?`${magnitude}-${countMetrics[countMetric].singular} advantage`:`${magnitude} advantage`;
  return finding.side==='our_team'?`Our strongest promoted statistical edge was ${label}: ${ourValue} to ${opponentValue}, a ${magnitudeLabel}.`:`${opponentName}'s strongest promoted statistical edge was ${label}: ${opponentValue} to our ${ourValue}, a ${magnitudeLabel}.`;
}

export function unsupportedQuestionMessage(reasonCode:UnsupportedReasonCode,capabilities:{rotationState:boolean;contactSequence?:boolean}={rotationState:false,contactSequence:false}):string{
  if(reasonCode==='prescriptive')return 'Coach’s Edge explains evidence but does not make personnel or tactical prescriptions.';
  if(reasonCode==='requires_rotation')return capabilities.rotationState?'This match has rotation-by-rotation evidence, but Coach’s Edge does not support rotation questions yet.':'The current evidence doesn’t include rotation-by-rotation data, so I can’t answer that question for this match.';
  if(reasonCode==='requires_contact_sequence')return capabilities.contactSequence?'This match has contact-sequence evidence, but Coach’s Edge does not support that contact-level question yet.':'The available source lacks the contact sequence required to answer that question, so I won’t estimate it.';
  return 'Coach’s Edge does not support that question type yet.';
}

export function insufficientEvidenceMessage(query:StructuredAnalyticsQuery):string{
  if(query.intent==='top_finding')return 'No stored finding clears the evidence threshold for that question. I won’t fill the answer with a weaker conclusion.';
  if((query.intent==='compare_metric'||query.intent==='metric_finding_status')&&query.metric){
    if(query.metric in percentageLabels)return `The current evidence doesn’t include enough ${percentageLabels[query.metric]} data to answer that question.`;
    if(query.metric==='longest_service_run')return 'The current evidence doesn’t include enough service-run data to answer that question.';
    const label=query.metric==='hitting_percentage'?'hitting-percentage':countMetrics[query.metric as keyof typeof countMetrics]?.singular??query.metric;
    return `The current evidence doesn’t include enough ${label} data to answer that question.`;
  }
  return 'The current evidence does not support that answer yet.';
}
