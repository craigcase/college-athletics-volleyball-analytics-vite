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

test('Coach Edge UI uses coach-facing shortcut guidance rather than developer roadmap language', async () => {
  const input=await readFile(new URL('../../src/components/CoachesEdgeInput.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(input,/broader resolver support/i);
  assert.match(input,/@/);
  assert.match(input,/#/);
  assert.match(input,/\/home/);
  assert.match(input,/\/away/);
  assert.match(input,/\/neutral/);
  assert.match(input,/normal coaching language/i);
});


test('program settings are available from the main app and keep season year out of ordinary identity editing', async () => {
  const shell=await readFile(new URL('../../src/components/AppShell.tsx',import.meta.url),'utf8');
  const app=await readFile(new URL('../../src/App.tsx',import.meta.url),'utf8');
  const page=await readFile(new URL('../../src/pages/ProgramSettingsPage.tsx',import.meta.url),'utf8');
  assert.match(shell,/Program Settings/);
  assert.match(app,/\/settings/);
  assert.match(page,/Full university name/);
  assert.match(page,/School abbreviation/);
  assert.match(page,/Mascot \/ team name/);
  assert.match(page,/Primary color/);
  assert.match(page,/Secondary color/);
  assert.match(page,/Accent color/);
  assert.doesNotMatch(page,/Season year/);
  assert.match(page,/primary app identity/i);
});

test('a program lookup failure is not treated as no program', async () => {
  const provider=await readFile(new URL('../../src/lib/program.tsx',import.meta.url),'utf8');
  const app=await readFile(new URL('../../src/App.tsx',import.meta.url),'utf8');
  assert.match(provider,/error:string\|null/);
  assert.match(provider,/setError/);
  assert.doesNotMatch(provider,/catch\s*\{\s*setProgram\(null\)/);
  assert.match(app,/ProgramLoadError/);
  assert.match(app,/Retry/);
});
