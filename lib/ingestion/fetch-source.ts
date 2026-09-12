import { validateImportUrl } from '../validation/url';

export async function fetchEvidenceUrl(input: string, maxBytes = 25 * 1024 * 1024): Promise<{ url:string; bytes:Uint8Array; contentType:string }> {
  let check = validateImportUrl(input);
  if (check.ok === false) throw new Error(check.reason);
  let current = check.url;
  for (let redirect=0; redirect<=5; redirect++) {
    const response = await fetch(current, { redirect:'manual', headers:{ 'user-agent':'College-Athletics-Consulting-Volleyball/1.0' } });
    if (response.status >= 300 && response.status < 400) {
      const location=response.headers.get('location');
      if (!location) throw new Error('Source redirect did not provide a destination.');
      check=validateImportUrl(new URL(location,current).toString());
      if (check.ok === false) throw new Error(check.reason);
      current=check.url;
      continue;
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    const length=Number(response.headers.get('content-length') ?? 0);
    if (length > maxBytes) throw new Error('Source exceeds the 25 MB V1 ingestion limit.');
    const buffer=await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new Error('Source exceeds the 25 MB V1 ingestion limit.');
    return { url:response.url || current.toString(), bytes:new Uint8Array(buffer), contentType:response.headers.get('content-type') ?? 'application/octet-stream' };
  }
  throw new Error('Too many redirects.');
}
