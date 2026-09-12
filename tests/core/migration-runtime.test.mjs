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
  assert.equal(pkg.scripts.dev, 'tsx watch scripts/local-dev-server.ts');
  assert.equal(pkg.scripts['dev:web'], undefined);
  assert.equal(pkg.scripts['dev:api'], undefined);
  assert.match(pkg.scripts.build, /vite build/);
  assert.equal(pkg.scripts.verify, 'npm test && npm run typecheck && npm run build');
  assert.equal(all.concurrently, undefined);
  assert.equal(typeof all.tsx, 'string');
  const viteConfig = await text('../../vite.config.ts');
  assert.match(viteConfig, /@vitejs\/plugin-react/);
  assert.equal(all['@netlify/vite-plugin'], undefined);
  assert.doesNotMatch(viteConfig, /localFunctionBridge|vite-local-functions|proxy|8787/);
  const localDev = await text('../../scripts/local-dev-server.ts');
  assert.match(localDev, /createServer as createHttpServer/);
  assert.match(localDev, /createServer as createViteServer/);
  assert.match(localDev, /middlewareMode:\s*true/);
  assert.match(localDev, /ws:\s*\{\s*server/);
  assert.match(localDev, /pathname\.startsWith\(['"]\/api\/['"]\)/);
  assert.match(localDev, /listen\(port, ['"]0\.0\.0\.0['"]/);
  assert.match(localDev, /const port = Number\(process\.env\.PORT \|\| 5173\)/);
  assert.doesNotMatch(localDev, /8787|LOCAL_API_PORT/);
  await assert.rejects(access(new URL('../../scripts/local-api-server.ts', import.meta.url)));
  const api = await text('../../src/lib/api.ts');
  assert.match(api, /const functionsBase='\/api'/);
  const netlify = await text('../../netlify.toml');
  assert.match(netlify, /from = "\/api\/\*"[\s\S]*to = "\/\.netlify\/functions\/:splat"/);
  assert.ok(netlify.indexOf('from = "/api/*"') < netlify.indexOf('from = "/*"'), 'API redirect must precede SPA fallback');
  for (const fn of ['program','roster-import','schedule-import','match-import-url','match-import-file','coaches-edge-query','roster','schedule','matches','match-summary']) {
    assert.match(localDev, new RegExp(`['\"]${fn}['\"]`));
  }
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


test('Vite node TypeScript config supports modern iterable syntax during build mode', async () => {
  const config = JSON.parse(await text('../../tsconfig.node.json'));
  assert.equal(config.compilerOptions.allowImportingTsExtensions, true);
  assert.equal(config.compilerOptions.noEmit, true);
  assert.equal(config.compilerOptions.target, 'ES2022');
  assert.ok(config.include.includes('scripts/**/*.ts'), 'Local development server must be included in node build project');
});

test('TypeScript build info files are ignored', async () => {
  const gitignore = await text('../../.gitignore');
  assert.match(gitignore, /^\*\.tsbuildinfo$/m);
});
