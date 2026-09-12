export type CurrentUser = { id: string; email: string; name?: string };
export type SupabaseUserLike = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };

export function getCurrentUserFromSupabase(user: SupabaseUserLike | null): CurrentUser | null {
  const email = user?.email?.trim().toLowerCase();
  if (!user?.id || !email) return null;
  const metadata = user.user_metadata ?? {};
  const candidate = metadata.full_name ?? metadata.name ?? metadata.display_name;
  const name = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
  return { id: user.id, email, ...(name ? { name } : {}) };
}
