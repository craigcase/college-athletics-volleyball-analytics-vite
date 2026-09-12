import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type RequestDbScope = {
  url: string;
  publishableKey: string;
  accessToken: string;
  evidenceBucket: string;
  client?: SupabaseClient;
};

let localUserScope: RequestDbScope | undefined;
let localRequestQueue: Promise<void> = Promise.resolve();
let adminClient: SupabaseClient | undefined;

function firstConfigured(...values: Array<string | undefined>) {
  return values.map(value => value?.trim()).find(Boolean) || '';
}

function userScopedConfig(accessToken: string): RequestDbScope {
  const url = firstConfigured(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const publishableKey = firstConfigured(
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!url || !publishableKey || !accessToken.trim()) throw new Error('SUPABASE_USER_DB_NOT_CONFIGURED');
  return {
    url,
    publishableKey,
    accessToken: accessToken.trim(),
    evidenceBucket: process.env.SUPABASE_EVIDENCE_BUCKET?.trim() || 'volleyball-evidence',
  };
}

function scopedClient(scope: RequestDbScope) {
  if (!scope.client) {
    scope.client = createClient(scope.url, scope.publishableKey, {
      global: { headers: { Authorization: `Bearer ${scope.accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
  return scope.client;
}

/**
 * StackBlitz WebContainers do not reliably preserve Node async request context
 * across browser-hosted network awaits. Local API requests are therefore
 * serialized and use one explicit module-local user scope for the duration
 * of each request. This helper is only used by scripts/local-dev-server.ts.
 */
export async function runWithUserAccessToken<T>(
  accessToken: string,
  work: () => T | Promise<T>,
): Promise<T> {
  const scope = userScopedConfig(accessToken);
  const previousRequest = localRequestQueue;
  let release!: () => void;
  localRequestQueue = new Promise<void>(resolve => {
    release = resolve;
  });

  await previousRequest;
  localUserScope = scope;
  try {
    return await work();
  } finally {
    localUserScope = undefined;
    release();
  }
}

export function hasUserDbScope() {
  return Boolean(localUserScope);
}

export function getAdminClient() {
  if (localUserScope) return scopedClient(localUserScope);

  if (process.env.SUPABASE_DB_ACCESS_MODE === 'user-scoped-only') {
    throw new Error('SUPABASE_REQUEST_NOT_SCOPED');
  }

  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error('SUPABASE_REQUEST_NOT_SCOPED');
  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return adminClient;
}

export function getEvidenceBucket() {
  return localUserScope?.evidenceBucket || process.env.SUPABASE_EVIDENCE_BUCKET?.trim() || 'volleyball-evidence';
}
