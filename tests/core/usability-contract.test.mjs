import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('primary navigation always exposes roster schedule matches and Coach Edge', async () => {
  const shell=await readFile(new URL('../../src/components/AppShell.tsx',import.meta.url),'utf8');
  assert.match(shell,/Roster/);
  assert.match(shell,/Schedule/);
  assert.match(shell,/Matches/);
  assert.match(shell,/Coach's Edge/);
});

test('match cards provide direct explicit summary navigation', async () => {
  const page=await readFile(new URL('../../src/pages/MatchesPage.tsx',import.meta.url),'utf8');
  assert.match(page,/View Summary/);
  assert.match(page,/\/matches\/\$\{m\.id\}/);
});

test('an existing roster clearly offers a refresh rather than destructive replacement', async () => {
  const page=await readFile(new URL('../../src/pages/RosterPage.tsx',import.meta.url),'utf8');
  assert.match(page,/Refresh Roster/);
  assert.match(page,/Updates existing players without deleting identities, photos, or staff corrections\./);
});
