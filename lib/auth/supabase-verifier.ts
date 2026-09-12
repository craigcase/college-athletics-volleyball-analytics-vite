import type { SupabaseUserLike } from './current-user.js';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SupabaseAccessTokenVerifierOptions = {
  url: string;
  publishableKey: string;
  fetchImpl?: FetchLike;
};

export async function verifySupabaseAccessToken(
  token: string,
  options: SupabaseAccessTokenVerifierOptions,
): Promise<SupabaseUserLike | null> {
  const jwt = token.trim();
  const url = options.url.trim().replace(/\/+$/, '');
  const publishableKey = options.publishableKey.trim();
  if (!jwt || !url || !publishableKey) return null;

  const response = await (options.fetchImpl ?? fetch)(`${url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${jwt}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) return null;
  const value = await response.json().catch(() => null) as SupabaseUserLike | null;
  if (!value?.id) return null;
  return value;
}
