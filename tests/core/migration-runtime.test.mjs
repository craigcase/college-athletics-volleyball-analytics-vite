import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const text = async path => readFile(new URL(path, import.meta.url), 'utf8');

test('runtime is Vite React + Supabase + Netlify with no Next/Sites/Cloudflare dependency', async () => {
  const pkg = JSON.parse(await text('../../package.json'));
  const all = {...pkg.dependencies, ...pkg.devDependencies};
  assert.equal(typeof all.vite, 'string');
  assert.equal(typeof all.react, 'string');
  assert.equal(typeof all['react-router-dom'], 'string');
  assert.equal(typeof all['@supabase/supabase-js'], 'string');
  for (const removed of ['next','@supabase/ssr','vinext','@openai/sites-vite-plugin','@cloudflare/vite-plugin','@cloudflare/workers-types','wrangler']) {
    assert.equal(all[removed], undefined, `${removed} should be removed`);
  }
  assert.match(pkg.scripts.dev, /^vite/);
  assert.match(pkg.scripts.build, /vite build/);
  assert.equal(pkg.scripts.verify, 'npm test && npm run typecheck && npm run build');
  const viteConfig = await text('../../vite.config.ts');
  assert.match(viteConfig, /@vitejs\/plugin-react/);
  const main = await text('../../src/main.tsx');
  assert.match(main, /BrowserRouter/);
  const css = await text('../../src/styles.css');
  assert.doesNotMatch(css, /tailwindcss/);
});

test('Netlify functions and Supabase migration artifacts exist', async () => {
  await access(new URL('../../netlify.toml', import.meta.url));
  await access(new URL('../../netlify/functions/program.ts', import.meta.url));
  await access(new URL('../../netlify/functions/roster-import.ts', import.meta.url));
  await access(new URL('../../netlify/functions/schedule-import.ts', import.meta.url));
  await access(new URL('../../netlify/functions/match-import-url.ts', import.meta.url));
  await access(new URL('../../netlify/functions/coaches-edge-query.ts', import.meta.url));
  const sql = await text('../../supabase/migrations/202609090001_initial.sql');
  assert.match(sql, /create table if not exists programs/i);
  assert.match(sql, /insert into storage\.buckets/i);
  assert.match(sql, /volleyball-evidence/i);
});

test('source tree has no production Next Cloudflare or Sites imports', async () => {
  const candidates = [
    '../../db/client.ts','../../db/repositories/sources.ts','../../netlify/functions/_shared/auth.ts',
    '../../netlify/functions/roster-import.ts','../../netlify/functions/schedule-import.ts','../../vite.config.ts'
  ];
  for (const path of candidates) {
    const source = await text(path);
    assert.doesNotMatch(source, /next\/(headers|navigation|server)|cloudflare:workers|oai-authenticated-user|@openai\/sites-vite-plugin|R2Bucket|D1Database/);
  }
});


test('Vite node TypeScript config supports build mode with TypeScript-extension imports', async () => {
  const config = JSON.parse(await text('../../tsconfig.node.json'));
  assert.equal(config.compilerOptions.allowImportingTsExtensions, true);
  assert.equal(config.compilerOptions.noEmit, true);
});
