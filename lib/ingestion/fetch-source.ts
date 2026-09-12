import { validateImportUrl } from '../validation/url';

export type FetchEvidenceOptions = {
  maxBytes?: number;
  accessToken?: string;
};

type FetchedEvidence = { url: string; bytes: Uint8Array; contentType: string };

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

function configuredValue(...values: Array<string | undefined>) {
  return values.map(value => value?.trim()).find(Boolean) || '';
}

function relayConfiguration() {
  const supabaseUrl = configuredValue(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const publishableKey = configuredValue(
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  return { supabaseUrl, publishableKey };
}

async function readError(response: Response) {
  try {
    const payload = await response.clone().json() as { error?: unknown; message?: unknown };
    if (typeof payload.error === 'string') return payload.error;
    if (typeof payload.message === 'string') return payload.message;
  } catch {
    // Fall through to text/status when the relay did not return JSON.
  }
  try {
    const text = (await response.text()).trim();
    if (text) return text.slice(0, 500);
  } catch {
    // Ignore body read errors and use the status below.
  }
  return `HTTP ${response.status}`;
}

async function fetchThroughSupabaseRelay(
  input: string,
  maxBytes: number,
  accessToken: string,
): Promise<FetchedEvidence> {
  const { supabaseUrl, publishableKey } = relayConfiguration();
  if (!supabaseUrl || !publishableKey) throw new Error('SUPABASE_FETCH_RELAY_NOT_CONFIGURED');
  if (!accessToken.trim()) throw new Error('SUPABASE_FETCH_RELAY_UNAUTHENTICATED');

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/fetch-public-source`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apikey': publishableKey,
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
    body: JSON.stringify({ url: input, maxBytes }),
  });

  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(`Public source relay failed: ${detail}`);
  }

  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) throw new Error('Source exceeds the 25 MB V1 ingestion limit.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new Error('Source exceeds the 25 MB V1 ingestion limit.');

  return {
    url: response.headers.get('x-source-url') || input,
    bytes: new Uint8Array(buffer),
    contentType: response.headers.get('x-source-content-type') || 'application/octet-stream',
  };
}

async function fetchDirect(input: string, maxBytes: number): Promise<FetchedEvidence> {
  let check = validateImportUrl(input);
  if (check.ok === false) throw new Error(check.reason);
  let current = check.url;
  for (let redirect = 0; redirect <= 5; redirect++) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: { 'user-agent': 'College-Athletics-Consulting-Volleyball/1.0' },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Source redirect did not provide a destination.');
      check = validateImportUrl(new URL(location, current).toString());
      if (check.ok === false) throw new Error(check.reason);
      current = check.url;
      continue;
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > maxBytes) throw new Error('Source exceeds the 25 MB V1 ingestion limit.');
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new Error('Source exceeds the 25 MB V1 ingestion limit.');
    return {
      url: response.url || current.toString(),
      bytes: new Uint8Array(buffer),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }
  throw new Error('Too many redirects.');
}

export async function fetchEvidenceUrl(
  input: string,
  options: FetchEvidenceOptions = {},
): Promise<FetchedEvidence> {
  const check = validateImportUrl(input);
  if (check.ok === false) throw new Error(check.reason);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (process.env.SUPABASE_DB_ACCESS_MODE === 'user-scoped-only') {
    return fetchThroughSupabaseRelay(check.url.toString(), maxBytes, options.accessToken || '');
  }

  return fetchDirect(check.url.toString(), maxBytes);
}
