import { withSupabase } from 'npm:@supabase/server@^1';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 5;

type ValidationResult = { ok: true; url: URL } | { ok: false; reason: string };

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part))) return false;
  const numbers = parts.map(Number);
  if (numbers.some(part => part < 0 || part > 255)) return true;
  return numbers[0] === 10 || numbers[0] === 127 ||
    (numbers[0] === 169 && numbers[1] === 254) ||
    (numbers[0] === 172 && numbers[1] >= 16 && numbers[1] <= 31) ||
    (numbers[0] === 192 && numbers[1] === 168) || numbers[0] === 0;
}

function isForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (/^(fc|fd|fe8|fe9|fea|feb)/i.test(host) && host.includes(':')) return true;
  return isPrivateIpv4(host);
}

function validatePublicUrl(input: string): ValidationResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: 'Invalid URL.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only HTTP(S) sources are allowed.' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Credentials in source URLs are not allowed.' };
  }
  if (isForbiddenHost(url.hostname)) {
    return { ok: false, reason: 'Private or local network destinations are not allowed.' };
  }
  return { ok: true, url };
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request) => {
    if (request.method !== 'POST') return jsonError('Method not allowed.', 405);

    let body: { url?: unknown; maxBytes?: unknown };
    try {
      body = await request.json();
    } catch {
      return jsonError('JSON body is required.', 400);
    }

    if (typeof body.url !== 'string') return jsonError('Source URL is required.', 400);
    const requestedLimit = typeof body.maxBytes === 'number' && Number.isFinite(body.maxBytes)
      ? Math.floor(body.maxBytes)
      : MAX_BYTES;
    const maxBytes = Math.min(MAX_BYTES, Math.max(1, requestedLimit));

    let check = validatePublicUrl(body.url);
    if (!check.ok) return jsonError(check.reason, 400);
    let current = check.url;

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      let response: Response;
      try {
        response = await fetch(current, {
          redirect: 'manual',
          headers: {
            'user-agent': 'College-Athletics-Consulting-Volleyball/1.0',
            'accept': 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'External source fetch failed.';
        return jsonError(`External source fetch failed: ${message}`, 502);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return jsonError('Source redirect did not provide a destination.', 502);
        check = validatePublicUrl(new URL(location, current).toString());
        if (!check.ok) return jsonError(check.reason, 400);
        current = check.url;
        continue;
      }

      if (!response.ok) return jsonError(`Source returned HTTP ${response.status}.`, 502);

      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > maxBytes) return jsonError('Source exceeds the 25 MB V1 ingestion limit.', 413);

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) return jsonError('Source exceeds the 25 MB V1 ingestion limit.', 413);

      const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
      return new Response(buffer, {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(buffer.byteLength),
          'cache-control': 'no-store',
          'x-source-url': response.url || current.toString(),
          'x-source-content-type': contentType,
          'access-control-expose-headers': 'x-source-url, x-source-content-type',
        },
      });
    }

    return jsonError('Too many redirects.', 502);
  }),
};
