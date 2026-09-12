export type ScheduleEvidence = {
  date: string;
  opponentName: string;
  homeAway: 'home' | 'away' | 'neutral' | 'unknown';
  location?: string;
  result?: string;
  setScores?: string[];
  sourceMatchId?: string;
  boxScoreUrl?: string;
};

const attrs = (tag: string) => {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)) result[match[1].toLowerCase()] = match[2];
  return result;
};

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const clean = (value: string | undefined) =>
  value ? decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || undefined : undefined;

const classContent = (block: string, className: string) =>
  block.match(
    new RegExp(
      `<([a-z0-9]+)\\b[^>]*class=["'][^"']*\\b${className}\\b(?!-)[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
      'i',
    ),
  )?.[2];

const classText = (block: string, className: string) => clean(classContent(block, className));

const classLinkText = (block: string, className: string) => {
  const content = classContent(block, className);
  return clean(content?.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
};

const scheduleYear = (html: string, sourceUrl: string, seasonYear?: number) => {
  if (seasonYear) return String(seasonYear);
  const pageText = clean(html.match(/<(?:title|h1|h2)\b[^>]*>([\s\S]*?)<\/(?:title|h1|h2)>/i)?.[1]);
  const fromHeading = pageText?.match(/\b(20\d{2})(?:-\d{2,4})?\s+Volleyball Schedule\b/i)?.[1];
  return fromHeading ?? sourceUrl.match(/\b(20\d{2})\b/)?.[1];
};

const visibleDateToIso = (value: string | undefined, year: string | undefined) => {
  if (!value || !year) return undefined;
  const match = value.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:\s+\([^)]+\))?(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i,
  );
  if (!match) return undefined;
  const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const month = months[match[1].slice(0, 3).toLowerCase()];
  if (!month) return undefined;
  const date = `${year}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  if (!match[3]) return date;
  let hour = Number(match[3]) % 12;
  if (match[5].toUpperCase() === 'PM') hour += 12;
  return `${date}T${String(hour).padStart(2, '0')}:${match[4]}:00`;
};

const scheduleGameBlocks = (html: string) => {
  const openingPattern = /<li\b[^>]*class=["'][^"']*\bsidearm-schedule-game\b(?!-)[^"']*["'][^>]*>/gi;
  return [...html.matchAll(openingPattern)].flatMap((openingMatch) => {
    const start = openingMatch.index;
    if (start === undefined) return [];
    const opening = openingMatch[0];
    const listTags = /<li\b[^>]*>|<\/li\s*>/gi;
    listTags.lastIndex = start + opening.length;
    let depth = 1;
    let tag: RegExpExecArray | null;
    while ((tag = listTags.exec(html))) {
      if (/^<\/li/i.test(tag[0])) depth -= 1;
      else if (!/\/>$/.test(tag[0])) depth += 1;
      if (depth === 0) return [{ opening, block: html.slice(start, listTags.lastIndex) }];
    }
    return [];
  });
};

export function parseScheduleHtml(html: string, sourceUrl: string, seasonYear?: number): ScheduleEvidence[] {
  const year = scheduleYear(html, sourceUrl, seasonYear);
  const blocks = scheduleGameBlocks(html);

  return blocks.flatMap(({ opening, block }) => {
    const attributes = attrs(opening);
    const timeTag = block.match(/<time\b[^>]*>/i)?.[0];
    const date =
      attributes['data-date'] ??
      (timeTag ? attrs(timeTag).datetime : undefined) ??
      visibleDateToIso(classText(block, 'sidearm-schedule-game-opponent-date'), year);
    const opponent =
      attributes['data-opponent'] ??
      classLinkText(block, 'sidearm-schedule-game-opponent-name') ??
      classText(block, 'sidearm-schedule-game-opponent-name') ??
      classText(block, 'sidearm-schedule-game-opponent-text');
    if (!date || !opponent) return [];

    const explicit = attributes['data-home-away'];
    const neutral =
      attributes['data-neutral'] === 'true' ||
      /\bsidearm-schedule-neutral-game\b/i.test(opening) ||
      explicit === 'neutral';
    const inferred = /\bsidearm-schedule-away-game\b/i.test(opening)
      ? 'away'
      : /\bsidearm-schedule-home-game\b/i.test(opening)
        ? 'home'
        : 'unknown';
    const homeAway: ScheduleEvidence['homeAway'] = neutral
      ? 'neutral'
      : explicit === 'home' || explicit === 'away'
        ? explicit
        : inferred;
    const item: ScheduleEvidence = { date, opponentName: opponent, homeAway };

    const location = attributes['data-location'] ?? classText(block, 'sidearm-schedule-game-location');
    if (location) item.location = location;
    const result = attributes['data-result'] ?? classText(block, 'sidearm-schedule-game-result');
    if (result) item.result = result;
    if (attributes['data-set-scores']) {
      item.setScores = attributes['data-set-scores'].split('|').map((score) => score.trim()).filter(Boolean);
    }
    const sourceMatchId = attributes['data-match-id'] ?? attributes['data-source-match-id'] ?? attributes['data-game-id'];
    if (sourceMatchId) item.sourceMatchId = sourceMatchId;
    const boxHref = attributes['data-boxscore-url'] ?? block.match(/<a[^>]*href=["']([^"']*\/boxscore\/[^"']*)["']/i)?.[1];
    if (boxHref) item.boxScoreUrl = new URL(decodeHtml(boxHref), sourceUrl).toString();
    return [item];
  });
}
