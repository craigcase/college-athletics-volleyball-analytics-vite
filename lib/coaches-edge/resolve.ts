import type { MetricCode, StructuredAnalyticsQuery } from './types.js';

export type ResolverContext = { matchId: string; opponentNames?: string[] };
export type UnsupportedReasonCode = 'prescriptive' | 'requires_rotation' | 'requires_contact_sequence' | 'unsupported_query';
export type ResolverResult =
  | { status: 'resolved'; query: StructuredAnalyticsQuery }
  | { status: 'unsupported'; reasonCode: UnsupportedReasonCode; reason: string };

const prescriptive = /\b(start|bench|sit|serve\s+target|who\s+should\s+serve|blocking\s+scheme|offensive\s+system)\b|\b(?:who|where|how)\s+should\s+(?:we\s+)?(?:serve|attack|target|block)\b|\bwho\s+should\s+we\s+target\b/i;
const rotationQuestion = /\b(rotation|rotations|r[1-6])\b/i;
const contactSequenceQuestion = /\b(t[1-9]\+?|transition\s+depth|good\s+dig|dig\s+quality|attack\s+grade|set\s+grade|block\s+grade|receive\s+grade|fbso\s+hitting|first[- ]ball\s+hitting)\b/i;
const comparisonLanguage = /\b(compare|versus|vs\.?|against|more|fewer|less|higher|lower|difference|better|worse)\b/i;
const ourLanguage = /\b(we|our|ours|us)\b/i;
const opponentLanguage = /\b(opponent|they|them|their)\b/i;
const findingLanguage = /\b(biggest|strongest|edge|advantage|stood\s+out|stand\s+out|finding|findings|cleared\s+the\s+evidence|promoted)\b/i;
const opponentStopWords = new Set(['state', 'university', 'college', 'the', 'and', 'women', 'womens', 'volleyball']);

function metricFromQuestion(text: string): MetricCode | null {
  if (/\bsos\s*2\b/i.test(text)) return 'sos2_percentage';
  if (/\bscore\s*1\b|first\s+(?:serving\s+)?point\s+after\s+(?:a\s+)?sideout|first\s+point\s+after\s+siding\s+out/i.test(text)) return 'score1_percentage';
  if (/\berror\s+pile[- ]?on\b|\bepo\b/i.test(text)) return 'epo_percentage';
  if (/\b(longest|best)\b[^?]*\bserv(?:e|ing)\s+runs?\b|\bserv(?:e|ing)\s+run\b[^?]*\b(longest|best)\b/i.test(text)) return 'longest_service_run';
  if (/\bpoint\s+scor(?:ed|ing)\s*(?:percentage|%|pct)?\b/i.test(text)) return 'point_scored_percentage';
  if (/\bside\s*out\s*(?:percentage|%|pct)?\b|\bsideout\s*(?:percentage|%|pct)?\b/i.test(text)) return 'sideout_percentage';
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
    const usefulTokens = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((token) => token.length >= 4 && !opponentStopWords.has(token));
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

function rallySubjectsFromQuestion(text:string,context:ResolverContext):('our_team'|'opponent')[]{
  const ourMentioned=ourLanguage.test(text),opponentIsMentioned=opponentMentioned(text,context.opponentNames??[]);
  if(/\b(compare|versus|vs\.?)\b/i.test(text))return ['our_team','opponent'];
  if(ourMentioned)return ['our_team'];
  if(opponentIsMentioned)return ['opponent'];
  return ['our_team'];
}

function comparisonFromQuestion(text: string): 'more' | 'fewer' | undefined {
  if (/\b(more|higher)\b/i.test(text)) return 'more';
  if (/\b(fewer|less|lower)\b/i.test(text)) return 'fewer';
  return undefined;
}
function findingSideFromQuestion(text: string, context: ResolverContext): 'our_team' | 'opponent' | 'either' {
  const ourMentioned = ourLanguage.test(text);
  const opponentIsMentioned = opponentMentioned(text, context.opponentNames ?? []);
  if (opponentIsMentioned && !ourMentioned && /\b(their|opponent|strongest|biggest|advantage|edge)\b/i.test(text)) return 'opponent';
  if (ourMentioned) return 'our_team';
  return 'either';
}
const rallyMetrics=new Set<MetricCode>(['sideout_percentage','point_scored_percentage','score1_percentage','sos2_percentage','epo_percentage','longest_service_run']);

export function resolveCoachQuestion(text: string, context: ResolverContext): ResolverResult {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return { status: 'unsupported', reasonCode: 'unsupported_query', reason: 'Coach’s Edge does not support that question type yet.' };
  if (prescriptive.test(normalized)) return {status:'unsupported',reasonCode:'prescriptive',reason:'Coach’s Edge explains evidence but does not make personnel or tactical prescriptions.'};
  if (rotationQuestion.test(normalized)) return { status: 'unsupported', reasonCode: 'requires_rotation', reason: 'rotation' };
  if (contactSequenceQuestion.test(normalized)) return {status:'unsupported',reasonCode:'requires_contact_sequence',reason:'contact_sequence'};

  const metric = metricFromQuestion(normalized);
  if(metric&&findingLanguage.test(normalized)){
    return {status:'resolved',query:{intent:'metric_finding_status',scope:{matchId:context.matchId},metric,subjects:['our_team','opponent'],findingSide:findingSideFromQuestion(normalized,context)}};
  }
  if (metric) {
    return {status:'resolved',query:{intent:'compare_metric',scope:{matchId:context.matchId},metric,subjects:rallyMetrics.has(metric)?rallySubjectsFromQuestion(normalized,context):subjectsFromQuestion(normalized,context),...(comparisonFromQuestion(normalized)?{comparison:comparisonFromQuestion(normalized)}:{})}};
  }
  if (findingLanguage.test(normalized)) return {status:'resolved',query:{intent:'top_finding',scope:{matchId:context.matchId},findingSide:findingSideFromQuestion(normalized,context)}};
  if (/\b(match|summary|overall)\b/.test(normalized)) return { status: 'resolved', query: { intent: 'match_summary', scope: { matchId: context.matchId } } };
  return {status:'unsupported',reasonCode:'unsupported_query',reason:'Coach’s Edge does not support that question type yet.'};
}
