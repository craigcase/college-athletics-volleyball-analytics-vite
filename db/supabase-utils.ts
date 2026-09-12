export function assertNoError(error: { message?: string; code?: string } | null | undefined, context: string): void {
  if (!error) return;
  const detail = error.code ? `${error.code}: ${error.message ?? 'unknown error'}` : error.message ?? 'unknown error';
  throw new Error(`${context}: ${detail}`);
}

export function byId<T extends { id: string }>(rows: T[] | null | undefined): Map<string, T> {
  return new Map((rows ?? []).map(row => [row.id, row]));
}
