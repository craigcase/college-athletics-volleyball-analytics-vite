export type RosterEvidence = {
  name: string;
  number?: string;
  officialPosition?: string;
  classYear?: string;
  height?: string;
  hometown?: string;
  previousSchool?: string;
  profileUrl?: string;
  imageUrl?: string;
  sourcePlayerId?: string;
};

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const clean = (value: string | undefined) =>
  value ? decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || undefined : undefined;

const attr = (tag: string, name: string) => {
  const value = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))?.[1];
  return value ? decodeHtml(value) : undefined;
};

const classContent = (block: string, className: string) =>
  block.match(
    new RegExp(
      `<([a-z0-9]+)\\b[^>]*class=["'][^"']*\\b${className}\\b(?!-)[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
      'i',
    ),
  )?.[2];

const classText = (block: string, className: string) => clean(classContent(block, className));

const headingProfile = (block: string) => {
  const match = block.match(/<h[1-6]\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>[\s\S]*?<\/h[1-6]>/i);
  if (!match) return undefined;
  const href = attr(match[1], 'href');
  const name = clean(match[2]);
  return name && href ? { name, href } : undefined;
};

export function parseRosterHtml(html: string, sourceUrl: string): RosterEvidence[] {
  const blocks = [
    ...html.matchAll(
      /<(article|li|div)\b([^>]*class=["'][^"']*\bsidearm-roster-player\b(?!-)[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    ),
  ];

  return blocks.flatMap((match) => {
    const opening = `<${match[1]}${match[2]}>`;
    const block = `${opening}${match[3]}</${match[1]}>`;
    const profile = headingProfile(block);
    const name = profile?.name ?? classText(block, 'sidearm-roster-player-name') ?? clean(attr(opening, 'data-name'));
    if (!name) return [];

    const result: RosterEvidence = { name };
    const number = classText(block, 'sidearm-roster-player-jersey-number') ?? clean(attr(opening, 'data-number'));
    if (number) result.number = number;
    const position = classText(block, 'sidearm-roster-player-position') ?? clean(attr(opening, 'data-position'));
    if (position) result.officialPosition = position;
    const year = classText(block, 'sidearm-roster-player-academic-year') ?? clean(attr(opening, 'data-class-year'));
    if (year) result.classYear = year;
    const height = classText(block, 'sidearm-roster-player-height');
    if (height) result.height = height;
    const hometown = classText(block, 'sidearm-roster-player-hometown');
    if (hometown) result.hometown = hometown;
    const previousSchool = classText(block, 'sidearm-roster-player-previous-school');
    if (previousSchool) result.previousSchool = previousSchool;

    const namedLink = block.match(/<a\b[^>]*class=["'][^"']*\bsidearm-roster-player-name-link\b(?!-)[^"']*["'][^>]*>/i)?.[0];
    const href = profile?.href ?? (namedLink ? attr(namedLink, 'href') : undefined) ?? attr(opening, 'data-player-url');
    if (href) result.profileUrl = new URL(href, sourceUrl).toString();
    const playerId = attr(opening, 'data-player-id');
    if (playerId) result.sourcePlayerId = playerId;

    for (const imageMatch of block.matchAll(/<img\b([^>]*)>/gi)) {
      const source = attr(imageMatch[1], 'data-src') ?? attr(imageMatch[1], 'src');
      if (source) {
        result.imageUrl = new URL(source, sourceUrl).toString();
        break;
      }
    }
    return [result];
  });
}
