import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImportUrl } from '../../.core-dist/lib/validation/url.js';
import { sha256Hex, detectSourceFamily } from '../../.core-dist/lib/ingestion/source-family.js';
import { validateUpload } from '../../.core-dist/lib/validation/upload.js';

test('URL validation allows public http(s) and rejects credentials, localhost, private IP literals and unsafe schemes', () => {
  assert.equal(validateImportUrl('https://example.edu/sports/volleyball/stats').ok, true);
  for (const input of [
    'file:///etc/passwd',
    'https://user:pass@example.edu/x',
    'http://localhost:3000/x',
    'http://127.0.0.1/x',
    'http://10.0.0.8/x',
    'http://192.168.1.2/x',
    'http://169.254.1.1/x',
    'ftp://example.edu/x'
  ]) assert.equal(validateImportUrl(input).ok, false, input);
});

test('source hashing is deterministic and source family detection is conservative', async () => {
  const bytes = new TextEncoder().encode('<xml><game></game></xml>');
  assert.equal(await sha256Hex(bytes), await sha256Hex(bytes));
  assert.equal(detectSourceFamily({ fileName: 'match.xml', contentType: 'application/xml', bytes }), 'official_xml');
  assert.equal(detectSourceFamily({ fileName: 'match.bin', contentType: 'application/octet-stream', bytes: new Uint8Array([1,2,3]) }), 'unknown');
});

test('upload validation enforces bounded evidence file size and recognized safe file shapes', () => {
  assert.equal(validateUpload({ name: 'match.xml', size: 1024, type: 'application/xml' }).ok, true);
  assert.equal(validateUpload({ name: 'match.exe', size: 1024, type: 'application/x-msdownload' }).ok, false);
  assert.equal(validateUpload({ name: 'huge.xml', size: 30 * 1024 * 1024, type: 'application/xml' }).ok, false);
});
