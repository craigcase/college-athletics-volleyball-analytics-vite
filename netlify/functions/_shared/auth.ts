import { getCurrentUserFromSupabase, type CurrentUser } from '../../../lib/auth/current-user.js';
import { verifySupabaseAccessToken } from '../../../lib/auth/supabase-verifier.js';
import { getActiveProgramForUser } from '../../../db/repositories/programs.js';

function authVerifierConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  if (!url || !publishableKey) throw new Error('SUPABASE_AUTH_NOT_CONFIGURED');
  return { url, publishableKey };
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<{ user: CurrentUser; accessToken: string }> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('UNAUTHENTICATED');

  const verified = await verifySupabaseAccessToken(token, authVerifierConfig());
  const user = getCurrentUserFromSupabase(verified);
  if (!user) throw new Error('UNAUTHENTICATED');
  return { user, accessToken: token };
}

export async function requireCurrentUser(request: Request): Promise<CurrentUser> {
  const { user } = await requireAuthenticatedUser(request);
  return user;
}

export async function requireProgramContext(request: Request) {
  const { user, accessToken } = await requireAuthenticatedUser(request);
  const program = await getActiveProgramForUser(user);
  if (!program) throw new Error('PROGRAM_SETUP_REQUIRED');
  return { user, program, accessToken };
}
