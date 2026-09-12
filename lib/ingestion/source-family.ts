export type SourceFamily = 'public_box_score' | 'official_roster' | 'official_schedule' | 'official_xml' | 'volleymetrics_xml' | 'unknown';

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function detectSourceFamily(input: { fileName?: string; contentType?: string; bytes: Uint8Array }): SourceFamily {
  const name = (input.fileName ?? '').toLowerCase();
  const type = (input.contentType ?? '').toLowerCase();
  const head = new TextDecoder().decode(input.bytes.slice(0, 8192)).toLowerCase();
  const looksXml = name.endsWith('.xml') || type.includes('xml') || /^\s*<\?xml|^\s*<[a-z]/.test(head);
  if (looksXml && /(volleymetrics|datavolley|vm[_ -]?match)/i.test(head)) return 'volleymetrics_xml';
  if (looksXml) return 'official_xml';
  if (name.endsWith('.html') || name.endsWith('.htm') || type.includes('html') || head.includes('<html')) return 'public_box_score';
  return 'unknown';
}
