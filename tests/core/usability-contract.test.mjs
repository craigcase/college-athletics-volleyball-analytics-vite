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

test('match summary exposes evidence-gated rally analytics without calculating them in React', async()=>{
  const page=await readFile(new URL('../../src/components/MatchSummary.tsx',import.meta.url),'utf8');
  for(const label of ['Rally Analytics','Sideout %','Point Scored %','Score1','SOS2','EPO','Longest Service Run','Sideout Pathways','Not available from this evidence'])assert.match(page,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(page,/summary\.rallyAnalytics/);
  assert.doesNotMatch(page,/calculateRallyAnalytics/);
});

test('match import review blocks ambiguous completion and exposes confirmation, alternate match, and missing schedule actions', async()=>{
  const drawer=await readFile(new URL('../../src/components/MatchImportDrawer.tsx',import.meta.url),'utf8');
  const review=await readFile(new URL('../../src/components/MatchImportReview.tsx',import.meta.url),'utf8').catch(()=> '');
  const quality=await readFile(new URL('../../src/components/ImportQualitySummary.tsx',import.meta.url),'utf8').catch(()=> '');
  assert.match(drawer,/needs_review/);
  assert.match(drawer,/MatchImportReview/);
  assert.match(review,/Match Import Review/);
  assert.match(review,/Confirm Match/);
  assert.match(review,/Choose Another Match/);
  assert.match(review,/This Match Is Missing From the Schedule/);
  assert.match(review,/Imported source/);
  assert.match(review,/Likely scheduled match/);
  assert.match(quality,/Import complete/);
  assert.match(quality,/Data level/);
  assert.match(quality,/rallies processed/i);
  assert.match(quality,/View Data Quality/);
});

test('deep data quality view is secondary, compact by point, and filters by set', async()=>{
  const page=await readFile(new URL('../../src/pages/MatchPage.tsx',import.meta.url),'utf8');
  const quality=await readFile(new URL('../../src/components/MatchDataQuality.tsx',import.meta.url),'utf8').catch(()=> '');
  assert.match(page,/Data Quality/);
  assert.match(page,/MatchDataQuality/);
  assert.match(quality,/All Sets/);
  assert.match(quality,/Set \{setNumber\}/);
  assert.match(quality,/Data Issue/);
  assert.match(quality,/Correct Play/);
  assert.match(quality,/Optional reason/);
  assert.match(quality,/Undo correction/);
  assert.match(quality,/activeOverrideFields/);
  assert.match(quality,/activeOverrideFields\.includes\('terminal_event_type'\)/);
  assert.match(quality,/terminal_event_type/);
  assert.match(quality,/canCorrectData/);
});

test('match summary uses the configured school abbreviation instead of generic US labels', async()=>{
  const summary=await readFile(new URL('../../src/components/MatchSummary.tsx',import.meta.url),'utf8');
  const page=await readFile(new URL('../../src/pages/MatchPage.tsx',import.meta.url),'utf8');
  assert.match(summary,/schoolAbbreviation/);
  assert.match(page,/schoolAbbreviation=\{program\.schoolAbbreviation\}/);
  assert.doesNotMatch(summary,/<small>US<\/small>/);
  assert.doesNotMatch(summary,/\?'US':'OPP'/);
  assert.doesNotMatch(summary,/>Us</);
});
