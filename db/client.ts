import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type RequestDbScope = {
  url: string;
  publishableKey: string;
  accessToken: string;
  evidenceBucket: string;
  client?: SupabaseClient;
};

const requestDb = new AsyncLocalStorage<RequestDbScope>();
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

export function runWithUserAccessToken<T>(accessToken: string, work: () => T): T {
  return requestDb.run(userScopedConfig(accessToken), work);
}

export function hasUserDbScope() {
  return Boolean(requestDb.getStore());
}

export function getAdminClient() {
  const scope = requestDb.getStore();
  if (scope) {
    if (!scope.client) {
      scope.client = createClient(scope.url, scope.publishableKey, {
        global: { headers: { Authorization: `Bearer ${scope.accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });
    }
    return scope.client;
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
  return requestDb.getStore()?.evidenceBucket || process.env.SUPABASE_EVIDENCE_BUCKET?.trim() || 'volleyball-evidence';
}
