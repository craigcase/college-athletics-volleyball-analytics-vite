import type {
  CanonicalRallyDraft,
  CanonicalTimelineDraft,
  ParsedScoringRecord,
  ParsedTimelineDraft,
  PointAttribution,
  RallyPathway,
  ScoreState,
  TeamSide,
  SetScoreIntegrity,
} from './timeline-types.js';
import { terminalAttribution } from './vbgame/common.js';

const opposite = (side: TeamSide): TeamSide => side === 'our_team' ? 'opponent' : 'our_team';
const addPoint = (score: ScoreState, side: TeamSide): ScoreState => side === 'our_team'
  ? { our: score.our + 1, opponent: score.opponent }
  : { our: score.our, opponent: score.opponent + 1 };

function supportedClassification(record: ParsedScoringRecord): { pathway: RallyPathway; attribution: PointAttribution } {
  const receivingSide = record.servingSide ? opposite(record.servingSide) : undefined;
  const terminal = record.terminal;
  if (terminal?.type === 'service_error' && receivingSide && record.pointWinner === receivingSide) {
    return { pathway: 'first_ball_sideout', attribution: 'given' };
  }
  if (terminal?.type === 'service_ace' && record.servingSide && record.pointWinner === record.servingSide) {
    return { pathway: 'direct_serve_point', attribution: 'earned' };
  }
  if (record.servingSide && record.pointWinner === record.servingSide) {
    return { pathway: 'transition_point', attribution: terminalAttribution(terminal) };
  }
  return { pathway: 'unknown_phase', attribution: terminalAttribution(terminal) };
}

function makePlaceholder(input: {
  setNumber: number;
  rallyNumber: number;
  scoreBefore: ScoreState;
  pointWinner: TeamSide;
  servingSide?: TeamSide;
  ambiguous?: boolean;
}): CanonicalRallyDraft {
  const receivingSide = input.servingSide ? opposite(input.servingSide) : undefined;
  return {
    setNumber: input.setNumber,
    rallyNumber: input.rallyNumber,
    scoreBefore: input.scoreBefore,
    scoreAfter: addPoint(input.scoreBefore, input.pointWinner),
    ...(input.servingSide ? { servingSide: input.servingSide } : {}),
    ...(receivingSide ? { receivingSide } : {}),
    pointWinner: input.pointWinner,
    pathway: 'unknown_phase',
    attribution: 'unknown',
    evidenceStatus: input.ambiguous ? 'ambiguous' : 'gap_placeholder',
    sourceLinks: [],
  };
}

function expectedBeforeExplicit(record: ParsedScoringRecord): ScoreState {
  return record.pointWinner === 'our_team'
    ? { our: record.scoreAfter.our - 1, opponent: record.scoreAfter.opponent }
    : { our: record.scoreAfter.our, opponent: record.scoreAfter.opponent - 1 };
}

function terminalForCanonicalServe(record: ParsedScoringRecord, servingSide?: TeamSide) {
  if (!record.terminal) return undefined;
  if (record.terminal.type === 'service_error' && servingSide && record.terminal.teamSide !== servingSide) {
    return { ...record.terminal, teamSide: servingSide };
  }
  return record.terminal;
}

export function buildCanonicalTimeline(draft: ParsedTimelineDraft): CanonicalTimelineDraft {
  const rallies: CanonicalRallyDraft[] = [];
  const setScoreIntegrity: SetScoreIntegrity[] = [];
  const recordsBySet = new Map<number, ParsedScoringRecord[]>();
  for (const record of draft.scoringRecords) {
    const rows = recordsBySet.get(record.setNumber) ?? [];
    rows.push(record);
    recordsBySet.set(record.setNumber, rows);
  }

  for (const final of [...draft.setFinalScores].sort((a, b) => a.setNumber - b.setNumber)) {
    const records = [...(recordsBySet.get(final.setNumber) ?? [])].sort((a, b) => a.sourceOrdinal - b.sourceOrdinal);
    let current: ScoreState = { our: 0, opponent: 0 };
    let rallyNumber = 0;
    let previousPointWinner: TeamSide | undefined;

    for (const record of records) {
      const beforeExplicit = expectedBeforeExplicit(record);
      const missingOur = beforeExplicit.our - current.our;
      const missingOpp = beforeExplicit.opponent - current.opponent;

      if (missingOur < 0 || missingOpp < 0) {
        rallyNumber += 1;
        const servingSide = previousPointWinner ?? record.servingSide;
        const receivingSide = servingSide ? opposite(servingSide) : undefined;
        const terminal = terminalForCanonicalServe(record, servingSide);
        const classified = supportedClassification({ ...record, ...(servingSide ? { servingSide } : {}), ...(terminal ? { terminal } : {}) });
        const sourceServeAgrees = !servingSide || !record.servingSide || servingSide === record.servingSide;
        rallies.push({
          setNumber: final.setNumber,
          rallyNumber,
          scoreBefore: current,
          scoreAfter: record.scoreAfter,
          ...(servingSide ? { servingSide } : {}),
          ...(receivingSide ? { receivingSide } : {}),
          ...(record.serverSourceKey && sourceServeAgrees ? { serverSourceKey: record.serverSourceKey } : {}),
          pointWinner: record.pointWinner,
          ...(terminal ? { terminal } : {}),
          pathway: classified.pathway,
          attribution: classified.attribution,
          evidenceStatus: 'ambiguous',
          sourceLinks: [{ sourceKey: record.sourceKey, sourceOrdinal: record.sourceOrdinal, confidence: 1 }],
        });
        current = record.scoreAfter;
        previousPointWinner = record.pointWinner;
        continue;
      }

      const ambiguousGap = missingOur > 0 && missingOpp > 0;
      const pushMissing = (side: TeamSide, count: number) => {
        for (let i = 0; i < count; i += 1) {
          rallyNumber += 1;
          const gap = makePlaceholder({ setNumber: final.setNumber, rallyNumber, scoreBefore: current, pointWinner: side, servingSide: previousPointWinner, ambiguous: ambiguousGap });
          rallies.push(gap);
          current = gap.scoreAfter;
          previousPointWinner = gap.pointWinner;
        }
      };
      pushMissing('our_team', missingOur);
      pushMissing('opponent', missingOpp);

      const explicitDeltaOur = record.scoreAfter.our - current.our;
      const explicitDeltaOpp = record.scoreAfter.opponent - current.opponent;
      const supported = (record.pointWinner === 'our_team' && explicitDeltaOur === 1 && explicitDeltaOpp === 0)
        || (record.pointWinner === 'opponent' && explicitDeltaOpp === 1 && explicitDeltaOur === 0);
      rallyNumber += 1;
      const servingSide = previousPointWinner ?? record.servingSide;
      const receivingSide = servingSide ? opposite(servingSide) : undefined;
      const terminal = terminalForCanonicalServe(record, servingSide);
      const classified = supportedClassification({ ...record, ...(servingSide ? { servingSide } : {}), ...(terminal ? { terminal } : {}) });
      const sourceServeAgrees = !servingSide || !record.servingSide || servingSide === record.servingSide;
      rallies.push({
        setNumber: final.setNumber,
        rallyNumber,
        scoreBefore: current,
        scoreAfter: record.scoreAfter,
        ...(servingSide ? { servingSide } : {}),
        ...(receivingSide ? { receivingSide } : {}),
        ...(record.serverSourceKey && sourceServeAgrees ? { serverSourceKey: record.serverSourceKey } : {}),
        pointWinner: record.pointWinner,
        ...(terminal ? { terminal } : {}),
        pathway: classified.pathway,
        attribution: classified.attribution,
        evidenceStatus: supported ? 'supported' : 'ambiguous',
        sourceLinks: [{ sourceKey: record.sourceKey, sourceOrdinal: record.sourceOrdinal, confidence: 1 }],
      });
      current = record.scoreAfter;
      previousPointWinner = record.pointWinner;
    }

    setScoreIntegrity.push({
      setNumber: final.setNumber,
      officialFinalScore: final.score,
      sourceFinalScore: current,
      status: current.our === final.score.our && current.opponent === final.score.opponent ? 'verified' : 'conflict',
    });
  }

  return { rallies, timelineEvents: draft.timelineEvents, setScoreIntegrity };
}
