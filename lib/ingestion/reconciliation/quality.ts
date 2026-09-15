import type { SourceFamily } from '../source-family.js';
import type { CanonicalTimelineDraft, VbgameProducer } from '../match/timeline-types.js';

export type ImportQualitySummary = {
  dataLevel: 'Basic' | 'Standard' | 'Rich';
  sourceLabel: string;
  rallyCount: number;
  directlyVerifiedCount: number;
  reconciledCount: number;
  unresolvedCount: number;
  structuralConflictCount: number;
  suppressedScope: 'none' | 'field_or_rally' | 'set';
};

export function buildImportQualitySummary(input:{sourceFamily:SourceFamily;producer?:VbgameProducer|'public_sidearm';timeline?:CanonicalTimelineDraft}):ImportQualitySummary {
  const rallies=input.timeline?.rallies??[];
  const structuralConflictCount=(input.timeline?.setScoreIntegrity??[]).filter(row=>row.status==='conflict').length;
  const reconciledCount=rallies.filter(row=>row.evidenceStatus==='uniquely_reconciled').length;
  const unresolvedCount=rallies.filter(row=>row.evidenceStatus==='gap_placeholder'||row.evidenceStatus==='ambiguous').length;
  const directlyVerifiedCount=rallies.filter(row=>row.evidenceStatus==='supported').length;
  const dataLevel=input.sourceFamily==='volleymetrics_xml'?'Rich':rallies.length?'Standard':'Basic';
  const sourceLabel=input.producer==='public_sidearm'?'Public website':input.sourceFamily==='official_xml'?'Official XML':input.sourceFamily==='volleymetrics_xml'?'VolleyMetrics':'Imported source';
  return {dataLevel,sourceLabel,rallyCount:rallies.length,directlyVerifiedCount,reconciledCount,unresolvedCount,structuralConflictCount,suppressedScope:structuralConflictCount?'set':unresolvedCount?'field_or_rally':'none'};
}
