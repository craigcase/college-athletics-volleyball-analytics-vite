import type { EvidenceObservation } from '../types.js';
import type { ParsedTimelineDraft, TeamSide } from './timeline-types.js';
import { classifyTerminalEvent } from './vbgame/common.js';

export type PublicBoxScoreEvidence = {
  match: { date?: string; opponentName?: string; homeAway?: 'home' | 'away' | 'neutral' | 'unknown'; sourceMatchId?: string; setScores?: string[] };
  observations: EvidenceObservation[];
  sourceUrl: string;
  producer: 'public_sidearm';
  timeline?: ParsedTimelineDraft;
};

export type PublicBoxScoreParseOptions = {
  ourTeamNames?: string[];
};

const attrs = (tag: string) => {
  const result: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)) result[m[1].toLowerCase()] = m[2];
  return result;
};
const number = (value: string | undefined) => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;

const decodeHtml = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const cellText = (html: string) => decodeHtml(
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
).replace(/\s+/g, ' ').trim();

const rowsFromTable = (tableHtml: string): string[][] => {
  const rows: string[][] = [];
  for (const row of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = [];
    for (const cell of row[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)) cells.push(cellText(cell[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
};

const tableGroups = (html: string): string[][][] => [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m => rowsFromTable(m[1])).filter(rows => rows.length > 0);
const tableRows = (html: string): string[][] => tableGroups(html).flat();

const normalizeTeamName = (value: string) => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
const teamMatches = (candidate: string, names: string[]) => {
  const normalized = normalizeTeamName(candidate);
  return names.some(name => {
    const expected = normalizeTeamName(name);
    if (!expected || !normalized) return false;
    if (expected === normalized) return true;
    const shortest = Math.min(expected.length, normalized.length);
    return shortest >= 4 && (expected.includes(normalized) || normalized.includes(expected));
  });
};

const isoDateFromUsDate = (value: string) => {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
};

function pushTeamValue(observations: EvidenceObservation[], entityKey: 'us' | 'opponent', field: string, raw: string | undefined) {
  const value = number(raw);
  if (value !== undefined) observations.push({ entityType: 'team', entityKey, field, value });
}

type TeamOrder = [{ name: string; key: 'us'|'opponent' }, { name: string; key: 'us'|'opponent' }];
function parseSidearmTables(html: string, ourTeamNames: string[]) {
  const rows = tableRows(html);
  const teamHeader = rows.find(row => row.length >= 3 && row[0].trim().toLowerCase() === 'set');
  if (!teamHeader) return { observations: [] as EvidenceObservation[] };

  const firstTeam = teamHeader[1];
  const secondTeam = teamHeader[2];
  const firstIsUs = teamMatches(firstTeam, ourTeamNames);
  const secondIsUs = teamMatches(secondTeam, ourTeamNames);
  if (firstIsUs === secondIsUs) return { observations: [] as EvidenceObservation[] };

  const firstKey: 'us' | 'opponent' = firstIsUs ? 'us' : 'opponent';
  const secondKey: 'us' | 'opponent' = firstIsUs ? 'opponent' : 'us';
  const opponentName = firstIsUs ? secondTeam : firstTeam;
  const observations: EvidenceObservation[] = [];

  const totalRow = rows.find(row => row.length >= 9 && row[0].trim().toLowerCase() === 'total');
  if (totalRow) {
    pushTeamValue(observations, firstKey, 'kills', totalRow[1]);
    pushTeamValue(observations, firstKey, 'attack_errors', totalRow[2]);
    pushTeamValue(observations, firstKey, 'attack_attempts', totalRow[3]);
    pushTeamValue(observations, secondKey, 'kills', totalRow[5]);
    pushTeamValue(observations, secondKey, 'attack_errors', totalRow[6]);
    pushTeamValue(observations, secondKey, 'attack_attempts', totalRow[7]);
  }

  const comparisonFields: Record<string, string> = { kills: 'kills', aces: 'aces', 'service errors': 'service_errors', blocks: 'blocks', assists: 'assists', digs: 'digs' };
  for (const row of rows) {
    if (row.length < 3) continue;
    const field = comparisonFields[row[0].trim().toLowerCase()];
    if (!field) continue;
    if (!observations.some(item => item.entityKey === firstKey && item.field === field)) pushTeamValue(observations, firstKey, field, row[1]);
    if (!observations.some(item => item.entityKey === secondKey && item.field === field)) pushTeamValue(observations, secondKey, field, row[2]);
  }

  return { observations, opponentName, teamOrder: [{ name: firstTeam, key: firstKey }, { name: secondTeam, key: secondKey }] as TeamOrder };
}

function toTeamSide(key: 'us'|'opponent'): TeamSide { return key === 'us' ? 'our_team' : 'opponent'; }

function parsePublicTimeline(html: string, teamOrder: TeamOrder | undefined, ourTeamNames: string[]): ParsedTimelineDraft | undefined {
  const groups = tableGroups(html);
  const pbpGroups = groups.filter(rows => {
    const header = rows[0]?.map(x => x.trim().toLowerCase()) ?? [];
    return header.includes('serve') && header.includes('score') && header.includes('play description');
  });
  if (!pbpGroups.length) return undefined;

  const scoringRecords: ParsedTimelineDraft['scoringRecords'] = [];
  const timelineEvents: ParsedTimelineDraft['timelineEvents'] = [];
  const setFinalScores: ParsedTimelineDraft['setFinalScores'] = [];

  pbpGroups.forEach((rows, setIndex) => {
    const setNumber = setIndex + 1;
    const header = rows[0].map(x => x.trim());
    const serveIndex = header.findIndex(x => x.toLowerCase() === 'serve');
    const scoreIndex = header.findIndex(x => x.toLowerCase() === 'score');
    const descIndex = header.findIndex(x => x.toLowerCase() === 'play description');
    const abbrevs = header.filter(x => /^[A-Z]{2,5}$/.test(x));
    const abbrToSide = new Map<string, TeamSide>();
    if (teamOrder && abbrevs.length >= 2) {
      abbrToSide.set(abbrevs[0], toTeamSide(teamOrder[0].key));
      abbrToSide.set(abbrevs[1], toTeamSide(teamOrder[1].key));
    } else {
      for (const abbr of abbrevs) {
        if (teamMatches(abbr, ourTeamNames)) abbrToSide.set(abbr, 'our_team');
      }
      const unknown = abbrevs.filter(a => !abbrToSide.has(a));
      if (abbrToSide.size === 1 && unknown.length === 1) abbrToSide.set(unknown[0], 'opponent');
    }

    let prior = { our: 0, opponent: 0 };
    let lastScore = prior;
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rawText = descIndex >= 0 ? (row[descIndex] ?? '').trim() : '';
      const sourceOrdinal = rowIndex;
      const sourceKey = `set-${setNumber}-row-${rowIndex}`;
      const scoreText = scoreIndex >= 0 ? row[scoreIndex] ?? '' : '';
      const scoreMatch = scoreText.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!scoreMatch) {
        if (/timeout/i.test(rawText)) timelineEvents.push({ setNumber, sourceKey, sourceOrdinal, type: 'timeout', rawText });
        continue;
      }
      const first = Number(scoreMatch[1]); const second = Number(scoreMatch[2]);
      let scoreAfter: { our: number; opponent: number };
      if (teamOrder) {
        const firstSide = toTeamSide(teamOrder[0].key);
        scoreAfter = firstSide === 'our_team' ? { our: first, opponent: second } : { our: second, opponent: first };
      } else {
        scoreAfter = { our: first, opponent: second };
      }
      const dOur = scoreAfter.our - prior.our; const dOpp = scoreAfter.opponent - prior.opponent;
      const pointWinner: TeamSide | undefined = dOur > 0 && dOpp === 0 ? 'our_team' : dOpp > 0 && dOur === 0 ? 'opponent' : undefined;
      if (!pointWinner) { prior = scoreAfter; lastScore = scoreAfter; continue; }
      const serveToken = serveIndex >= 0 ? (row[serveIndex] ?? '').trim() : '';
      const servingSide = abbrToSide.get(serveToken);
      const serverSourceKey = rawText.match(/^\[([^\]]+)\]/)?.[1]?.trim();
      const terminal = classifyTerminalEvent(rawText, pointWinner, servingSide);
      scoringRecords.push({ setNumber, sourceKey, sourceOrdinal, ...(servingSide ? { servingSide } : {}), ...(serverSourceKey ? { serverSourceKey } : {}), pointWinner, scoreAfter, rawText, ...(terminal.type !== 'unknown' ? { terminal } : {}) });
      prior = scoreAfter; lastScore = scoreAfter;
    }
    setFinalScores.push({ setNumber, score: lastScore });
  });

  return { producer: 'public_sidearm', setFinalScores, scoringRecords, timelineEvents };
}

export function parsePublicBoxScoreHtml(html: string, sourceUrl: string, options: PublicBoxScoreParseOptions = {}): PublicBoxScoreEvidence {
  const title = cellText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const sectionTag = html.match(/<section\b[^>]*data-match-date=["'][^"']+["'][^>]*>/i)?.[0] ?? '';
  const section = attrs(sectionTag);
  const homeAwayRaw = section['data-home-away'];
  const homeAway = homeAwayRaw === 'home' || homeAwayRaw === 'away' || homeAwayRaw === 'neutral' ? homeAwayRaw : homeAwayRaw ? 'unknown' : undefined;
  const match: PublicBoxScoreEvidence['match'] = {};
  if (section['data-match-date']) match.date = section['data-match-date'];
  if (section['data-opponent']) match.opponentName = section['data-opponent'];
  if (homeAway) match.homeAway = homeAway;
  const sourceMatchId = sourceUrl.match(/\/boxscore\/([^/?#]+)/i)?.[1];
  if (sourceMatchId) match.sourceMatchId = sourceMatchId;
  if (!match.opponentName) {
    const titleOpponent = title.match(/\bvs\.?\s+(.+?)\s+on\s+\d{1,2}\/\d{1,2}\/\d{4}\b/i)?.[1];
    if (titleOpponent) match.opponentName = titleOpponent.trim();
  }
  if (!match.date) {
    const dateText = title.match(/\bon\s+(\d{1,2}\/\d{1,2}\/\d{4})\b/i)?.[1];
    const parsedDate = dateText ? isoDateFromUsDate(dateText) : undefined;
    if (parsedDate) match.date = parsedDate;
  }

  const observations: EvidenceObservation[] = [];
  const fieldMap: Record<string, string> = { 'data-kills': 'kills', 'data-errors': 'attack_errors', 'data-attempts': 'attack_attempts', 'data-aces': 'aces', 'data-service-errors': 'service_errors', 'data-digs': 'digs', 'data-blocks': 'blocks', 'data-assists': 'assists', 'data-reception-errors': 'reception_errors' };
  for (const m of html.matchAll(/<div\b[^>]*data-team=["'](?:us|opponent)["'][^>]*>/gi)) {
    const a = attrs(m[0]); const entityKey = a['data-team'];
    for (const [attribute, field] of Object.entries(fieldMap)) {
      const value = number(a[attribute]);
      if (value !== undefined) observations.push({ entityType: 'team', entityKey, field, value });
    }
  }

  const siteTeamName = title.match(/-\s*Box Score\s*-\s*(.+)$/i)?.[1]?.trim();
  const sidearm = options.ourTeamNames?.length ? parseSidearmTables(html, [...options.ourTeamNames, ...(siteTeamName ? [siteTeamName] : [])]) : { observations: [] as EvidenceObservation[] };
  if (observations.length === 0) observations.push(...sidearm.observations);
  if (!match.opponentName && 'opponentName' in sidearm && sidearm.opponentName) match.opponentName = sidearm.opponentName;

  const timeline = parsePublicTimeline(html, 'teamOrder' in sidearm ? sidearm.teamOrder : undefined, options.ourTeamNames ?? []);
  if (timeline?.setFinalScores.length) match.setScores = timeline.setFinalScores.map(({ score }) => `${score.our}-${score.opponent}`);
  return { match, observations, sourceUrl, producer: 'public_sidearm', ...(timeline ? { timeline } : {}) };
}
