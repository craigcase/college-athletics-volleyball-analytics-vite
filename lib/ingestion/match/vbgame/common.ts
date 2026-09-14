import type { PointAttribution, ScoreState, TeamSide, TerminalEvent } from '../timeline-types.js';

export function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)) out[m[1].toLowerCase()] = m[2];
  return out;
}

export function numeric(value?: string): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeName(value?: string): string {
  return (value ?? '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9]+/g, ' ').trim();
}

function aliasMatches(value: string | undefined, aliases: string[]): boolean {
  const normalized = normalizeName(value);
  if (!normalized) return false;
  return aliases.some(alias => {
    const n = normalizeName(alias);
    if (!n) return false;
    return normalized === n || (n.length >= 4 && (normalized.startsWith(`${n} `) || normalized.includes(` ${n} `)));
  });
}

function dateIso(value?: string): string | undefined {
  if (!value) return undefined;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export type VbgameTeamContext = {
  vh: 'V' | 'H';
  id?: string;
  name?: string;
  body: string;
  attrs: Record<string, string>;
};

export type VbgameContext = {
  date?: string;
  opponentName?: string;
  homeAway?: 'home' | 'away' | 'neutral' | 'unknown';
  sourceMatchId?: string;
  scoreOurVh?: 'V' | 'H';
  ourSourceIds: string[];
  opponentSourceIds: string[];
  sideBySourceKey: Map<string, TeamSide>;
  teamByVh: Partial<Record<'V' | 'H', VbgameTeamContext>>;
  setFinalScores: Array<{ setNumber: number; score: ScoreState }>;
};

export function readVbgameContext(xml: string, ourTeamNames: string[] = []): VbgameContext {
  const venueTag = xml.match(/<venue\b[^>]*>/i)?.[0] ?? '';
  const venue = attrs(venueTag);
  const teams: VbgameTeamContext[] = [];
  for (const m of xml.matchAll(/<team\b([^>]*)>([\s\S]*?)<\/team>/gi)) {
    const a = attrs(`<team ${m[1]}>`);
    const vh = a.vh?.toUpperCase();
    if (vh !== 'V' && vh !== 'H') continue;
    teams.push({ vh, id: a.id?.trim(), name: a.name?.trim(), body: m[2], attrs: a });
  }

  const matches = teams.filter(team => aliasMatches(team.name, ourTeamNames) || aliasMatches(team.id, ourTeamNames));
  const ourTeam = matches.length === 1 ? matches[0] : undefined;
  const opponent = ourTeam ? teams.find(team => team !== ourTeam) : undefined;
  const teamByVh: VbgameContext['teamByVh'] = {};
  for (const team of teams) teamByVh[team.vh] = team;

  const sideBySourceKey = new Map<string, TeamSide>();
  const addSideKeys = (team: VbgameTeamContext | undefined, side: TeamSide) => {
    if (!team) return;
    for (const key of [team.id, team.name]) {
      const n = normalizeName(key);
      if (n) sideBySourceKey.set(n, side);
    }
  };
  addSideKeys(ourTeam, 'our_team');
  addSideKeys(opponent, 'opponent');

  const physicalVisitorIsUs = aliasMatches(venue.visid, ourTeamNames) || aliasMatches(venue.visname, ourTeamNames);
  const physicalHomeIsUs = aliasMatches(venue.homeid, ourTeamNames) || aliasMatches(venue.homename, ourTeamNames);
  let homeAway: VbgameContext['homeAway'] = 'unknown';
  if ((venue.neutralgame ?? '').toUpperCase() === 'Y') homeAway = 'neutral';
  else if (physicalVisitorIsUs && !physicalHomeIsUs) homeAway = 'away';
  else if (physicalHomeIsUs && !physicalVisitorIsUs) homeAway = 'home';

  const setFinalScores: VbgameContext['setFinalScores'] = [];
  if (ourTeam && opponent) {
    const ourGames = new Map<number, number>();
    const oppGames = new Map<number, number>();
    for (const m of ourTeam.body.matchAll(/<linegame\b[^>]*>/gi)) {
      const a = attrs(m[0]); const game = numeric(a.game); const points = numeric(a.points);
      if (game !== undefined && points !== undefined) ourGames.set(game, points);
    }
    for (const m of opponent.body.matchAll(/<linegame\b[^>]*>/gi)) {
      const a = attrs(m[0]); const game = numeric(a.game); const points = numeric(a.points);
      if (game !== undefined && points !== undefined) oppGames.set(game, points);
    }
    const games = [...new Set([...ourGames.keys(), ...oppGames.keys()])].sort((a, b) => a - b);
    for (const game of games) {
      const our = ourGames.get(game); const opp = oppGames.get(game);
      if (our !== undefined && opp !== undefined) setFinalScores.push({ setNumber: game, score: { our, opponent: opp } });
    }
  }

  return {
    date: dateIso(venue.date),
    opponentName: opponent?.name,
    homeAway,
    sourceMatchId: venue.gameid?.trim() || undefined,
    scoreOurVh: ourTeam?.vh,
    ourSourceIds: [ourTeam?.id, ourTeam?.name].filter((v): v is string => Boolean(v)),
    opponentSourceIds: [opponent?.id, opponent?.name].filter((v): v is string => Boolean(v)),
    sideBySourceKey,
    teamByVh,
    setFinalScores,
  };
}

export function sourceKeyToSide(context: VbgameContext, value?: string): TeamSide | undefined {
  const n = normalizeName(value);
  if (!n) return undefined;
  return context.sideBySourceKey.get(n);
}

function opposite(side: TeamSide): TeamSide { return side === 'our_team' ? 'opponent' : 'our_team'; }

function cleanPlayer(value?: string): string | undefined {
  const v = value?.replace(/[.)]+$/g, '').trim();
  return v || undefined;
}

export function classifyTerminalEvent(
  text: string,
  pointWinner: TeamSide,
  servingSide?: TeamSide,
): TerminalEvent {
  const rawText = text.trim();
  let type: TerminalEvent['type'] = 'unknown';
  let teamSide: TeamSide | undefined;
  let playerSourceKey: string | undefined;
  let assistSourceKeys: string[] | undefined;
  let blockerSourceKeys: string[] | undefined;

  if (/Service ace/i.test(rawText)) {
    type = 'service_ace'; teamSide = pointWinner;
    playerSourceKey = cleanPlayer(rawText.match(/^\[([^\]]+)\]/)?.[1]);
  } else if (/Service error/i.test(rawText)) {
    type = 'service_error'; teamSide = servingSide;
    playerSourceKey = cleanPlayer(rawText.match(/^\[([^\]]+)\]/)?.[1]);
  } else if (/Attack error by .+\(block by /i.test(rawText)) {
    type = 'stuff_block'; teamSide = pointWinner;
    const block = rawText.match(/\(block by ([^)]+)\)/i)?.[1];
    blockerSourceKeys = block?.split(';').map(s => s.trim()).filter(Boolean);
  } else if (/Kill by /i.test(rawText)) {
    type = 'kill'; teamSide = pointWinner;
    playerSourceKey = cleanPlayer(rawText.match(/Kill by ([^(]+?)(?:\s+from\s+|\s*\(|\.?$)/i)?.[1]);
    const assists = rawText.match(/(?:from\s+\(|\(from\s+)([^)]+)\)/i)?.[1]
      ?? rawText.match(/\(from ([^)]+)\)/i)?.[1]
      ?? rawText.match(/from ([^.]+)\.?$/i)?.[1];
    assistSourceKeys = assists?.split(';').map(s => s.trim()).filter(Boolean);
  } else if (/Bad set by /i.test(rawText)) {
    type = 'setting_error'; teamSide = opposite(pointWinner);
    playerSourceKey = cleanPlayer(rawText.match(/Bad set by ([^.]+)/i)?.[1]);
  } else if (/Ball handling error|\bBHE\b/i.test(rawText)) {
    type = 'ball_handling_error'; teamSide = opposite(pointWinner);
  } else if (/Block error|blocking error|net violation/i.test(rawText)) {
    type = 'blocking_error'; teamSide = opposite(pointWinner);
  } else if (/Attack error by /i.test(rawText)) {
    type = 'attack_error'; teamSide = opposite(pointWinner);
    playerSourceKey = cleanPlayer(rawText.match(/Attack error by ([^(\.]+)/i)?.[1]);
  } else if (/penalty/i.test(rawText)) {
    type = 'penalty_point'; teamSide = pointWinner;
  }

  return { type, ...(teamSide ? { teamSide } : {}), ...(playerSourceKey ? { playerSourceKey } : {}), ...(assistSourceKeys?.length ? { assistSourceKeys } : {}), ...(blockerSourceKeys?.length ? { blockerSourceKeys } : {}), rawText };
}

export function terminalAttribution(terminal?: TerminalEvent): PointAttribution {
  if (!terminal) return 'unknown';
  if (terminal.type === 'service_ace' || terminal.type === 'kill' || terminal.type === 'stuff_block') return 'earned';
  if (terminal.type === 'service_error' || terminal.type === 'attack_error' || terminal.type === 'setting_error' || terminal.type === 'ball_handling_error' || terminal.type === 'blocking_error') return 'given';
  return 'unknown';
}

export function scoreFromVh(context: VbgameContext, vscore?: string, hscore?: string): ScoreState | undefined {
  const v = numeric(vscore); const h = numeric(hscore);
  if (v === undefined || h === undefined || !context.scoreOurVh) return undefined;
  return context.scoreOurVh === 'V' ? { our: v, opponent: h } : { our: h, opponent: v };
}

export function inferTimelineTeamSide(context: VbgameContext, text: string): TeamSide | undefined {
  const n = normalizeName(text);
  for (const value of context.ourSourceIds) if (n.includes(normalizeName(value))) return 'our_team';
  for (const value of context.opponentSourceIds) if (n.includes(normalizeName(value))) return 'opponent';
  return undefined;
}

export function extractTeamTotalsObservations(context: VbgameContext) {
  const observations: Array<{ entityType: 'team'; entityKey: 'us' | 'opponent'; field: string; value: number }> = [];
  const pushTeam = (team: VbgameTeamContext | undefined, entityKey: 'us' | 'opponent') => {
    if (!team) return;
    const totals = team.body.match(/<totals\b[^>]*>([\s\S]*?)<\/totals>/i)?.[1] ?? '';
    const attack = attrs(totals.match(/<attack\b[^>]*>/i)?.[0] ?? '');
    const set = attrs(totals.match(/<set\b[^>]*>/i)?.[0] ?? '');
    const serve = attrs(totals.match(/<serve\b[^>]*>/i)?.[0] ?? '');
    const defense = attrs(totals.match(/<defense\b[^>]*>/i)?.[0] ?? '');
    const block = attrs(totals.match(/<block\b[^>]*>/i)?.[0] ?? '');
    const mappings: Array<[Record<string,string>, string, string]> = [
      [attack, 'k', 'kills'], [attack, 'e', 'attack_errors'], [attack, 'ta', 'attack_attempts'],
      [set, 'a', 'assists'], [serve, 'sa', 'aces'], [serve, 'se', 'service_errors'],
      [defense, 'dig', 'digs'], [defense, 're', 'reception_errors'], [block, 'tb', 'blocks'],
    ];
    for (const [source, key, field] of mappings) {
      const value = numeric(source[key]);
      if (value !== undefined) observations.push({ entityType: 'team', entityKey, field, value });
    }
  };
  pushTeam(context.scoreOurVh ? context.teamByVh[context.scoreOurVh] : undefined, 'us');
  const oppVh = context.scoreOurVh === 'V' ? 'H' : context.scoreOurVh === 'H' ? 'V' : undefined;
  pushTeam(oppVh ? context.teamByVh[oppVh] : undefined, 'opponent');
  return observations;
}

export function parseVbgameTimeline(
  xml: string,
  producer: 'presto_vbgame' | 'livestats_vbgame' | 'genius_vbgame',
  context: VbgameContext,
) {
  const scoringRecords: import('../timeline-types.js').ParsedScoringRecord[] = [];
  const timelineEvents: import('../timeline-types.js').ParsedTimelineEvent[] = [];
  for (const gm of xml.matchAll(/<game\b[^>]*number=["'](\d+)["'][^>]*>([\s\S]*?)<\/game>/gi)) {
    const setNumber = Number(gm[1]);
    let fallbackOrdinal = 0;
    for (const pm of gm[2].matchAll(/<play\b([^>]*?)(?:\/\s*>|>(?:[\s\S]*?)<\/play>)/gi)) {
      fallbackOrdinal += 1;
      const a = attrs(`<play ${pm[1]}>`);
      const sourceOrdinal = numeric(a.number) ?? fallbackOrdinal;
      const sourceKey = `set-${setNumber}-play-${sourceOrdinal}`;
      const rawText = (a.text ?? '').trim();
      const servingSide = sourceKeyToSide(context, a.serveteam);
      const pointWinner = sourceKeyToSide(context, a.point);
      const scoreAfter = scoreFromVh(context, a.vscore, a.hscore);
      if (pointWinner && scoreAfter && a.point) {
        const serverSourceKey = rawText.match(/^\[([^\]]+)\]/)?.[1]?.trim();
        const terminal = classifyTerminalEvent(rawText, pointWinner, servingSide);
        scoringRecords.push({
          setNumber, sourceKey, sourceOrdinal,
          ...(servingSide ? { servingSide } : {}),
          ...(serverSourceKey ? { serverSourceKey } : {}),
          pointWinner, scoreAfter, rawText,
          ...(terminal.type !== 'unknown' ? { terminal } : {}),
        });
        continue;
      }
      const lower = rawText.toLowerCase();
      let type: import('../timeline-types.js').ParsedTimelineEvent['type'] | undefined;
      if (lower.includes('timeout')) type = 'timeout';
      else if (lower.includes('starters:')) type = 'starter_announcement';
      else if (/\bsubs?:\b|substitution/i.test(rawText)) type = 'substitution';
      else if (lower.includes('challenge')) type = 'challenge';
      else if (lower.includes('penalty')) type = 'penalty';
      else if (lower.includes('official adjustment') || lower.includes('rotation correction')) type = 'official_adjustment';
      if (type) {
        const teamSide = inferTimelineTeamSide(context, rawText);
        timelineEvents.push({ setNumber, sourceKey, sourceOrdinal, type, ...(teamSide ? { teamSide } : {}), rawText });
      }
    }
  }
  return { producer, setFinalScores: context.setFinalScores, scoringRecords, timelineEvents };
}
