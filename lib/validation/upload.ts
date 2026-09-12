export const MAX_MATCH_UPLOAD_BYTES = 25 * 1024 * 1024;
const SAFE_EXTENSIONS = new Set(['xml', 'html', 'htm', 'txt', 'json']);
const SAFE_TYPES = new Set(['application/xml','text/xml','text/html','text/plain','application/json','application/octet-stream']);

export function validateUpload(file: { name: string; size: number; type?: string }): { ok: boolean; reason?: string } {
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, reason: 'File is empty.' };
  if (file.size > MAX_MATCH_UPLOAD_BYTES) return { ok: false, reason: 'File exceeds the 25 MB V1 upload limit.' };
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!SAFE_EXTENSIONS.has(extension)) return { ok: false, reason: 'Unsupported evidence file type.' };
  if (file.type && !SAFE_TYPES.has(file.type.toLowerCase())) return { ok: false, reason: 'Unsupported evidence content type.' };
  return { ok: true };
}
