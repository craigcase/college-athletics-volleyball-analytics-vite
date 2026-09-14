import type { ParsedMatchSource } from '../parse-source.js';
import { extractTeamTotalsObservations, parseVbgameTimeline, readVbgameContext } from './common.js';

export function parsePrestoVbgame(xml: string, sourceUrl: string, ourTeamNames: string[]): ParsedMatchSource {
  const context = readVbgameContext(xml, ourTeamNames);
  const observations = extractTeamTotalsObservations(context);
  const setScores = context.setFinalScores.map(({ score }) => `${score.our}-${score.opponent}`);
  return {
    match: {
      ...(context.date ? { date: context.date } : {}),
      ...(context.opponentName ? { opponentName: context.opponentName } : {}),
      ...(context.homeAway ? { homeAway: context.homeAway } : {}),
      ...(context.sourceMatchId ? { sourceMatchId: context.sourceMatchId } : {}),
      ...(setScores.length ? { setScores } : {}),
    },
    observations,
    sourceUrl,
    sourceFamily: 'official_xml',
    producer: 'presto_vbgame',
    timeline: parseVbgameTimeline(xml, 'presto_vbgame', context),
  };
}
