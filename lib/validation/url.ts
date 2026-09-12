export type ValidationResult = { ok: true; url: URL } | { ok: false; reason: string };

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) return false;
  const n = parts.map(Number);
  if (n.some((p) => p < 0 || p > 255)) return true;
  return n[0] === 10 || n[0] === 127 ||
    (n[0] === 169 && n[1] === 254) ||
    (n[0] === 172 && n[1] >= 16 && n[1] <= 31) ||
    (n[0] === 192 && n[1] === 168) || n[0] === 0;
}

function isForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (/^(fc|fd|fe8|fe9|fea|feb)/i.test(host) && host.includes(':')) return true;
  return isPrivateIpv4(host);
}

export function validateImportUrl(input: string): ValidationResult {
  let url: URL;
  try { url = new URL(input); } catch { return { ok: false, reason: 'Invalid URL.' }; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'Only HTTP(S) sources are allowed.' };
  if (url.username || url.password) return { ok: false, reason: 'Credentials in source URLs are not allowed.' };
  if (isForbiddenHost(url.hostname)) return { ok: false, reason: 'Private or local network destinations are not allowed.' };
  return { ok: true, url };
}
