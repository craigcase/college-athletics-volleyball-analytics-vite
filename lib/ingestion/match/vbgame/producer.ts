import type { VbgameProducer } from '../timeline-types.js';

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)) out[m[1].toLowerCase()] = m[2];
  return out;
}

export function detectVbgameProducer(xml: string): VbgameProducer {
  const root = xml.match(/<vbgame\b[^>]*>/i)?.[0] ?? '';
  const source = attrs(root).source?.trim().toLowerCase() ?? '';
  if (source === 'prestosports') return 'presto_vbgame';
  if (source.includes('volleyball livestats')) return 'livestats_vbgame';
  if (source.includes('genius')) return 'genius_vbgame';
  return 'unknown_vbgame';
}
