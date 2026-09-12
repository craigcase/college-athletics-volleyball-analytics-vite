import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterHtml } from '../../.core-dist/lib/ingestion/roster/sidearm.js';
import { parseScheduleHtml } from '../../.core-dist/lib/ingestion/schedule/sidearm.js';
import { parsePublicBoxScoreHtml } from '../../.core-dist/lib/ingestion/match/public-boxscore.js';
import { parseStructuredXml } from '../../.core-dist/lib/ingestion/match/xml.js';
import { resolveCanonicalMatch } from '../../.core-dist/lib/ingestion/match/resolve-match.js';
import { detectCapabilities } from '../../.core-dist/lib/capabilities/detect.js';
import { calculateMatchAnalytics } from '../../.core-dist/lib/analytics/match.js';
import { resolveCoachQuestion } from '../../.core-dist/lib/coaches-edge/resolve.js';
import { executeAnalyticsQuery } from '../../.core-dist/lib/coaches-edge/execute.js';

test('vertical slice keeps schedule match canonical, computes deterministically, and Coach Edge reads stored result', () => {
  const roster = parseRosterHtml(`<div class="sidearm-roster-player" data-name="Ava Geist" data-number="7" data-position="OH"></div>`, 'https://example.edu/roster');
  assert.equal(roster.length, 1);
  const schedule = parseScheduleHtml(`<li class="sidearm-schedule-game" data-date="2026-09-05" data-opponent="Mayville State" data-home-away="away" data-source-match-id="box-42"></li>`, 'https://example.edu/schedule');
  assert.equal(schedule.length, 1);

  const box = parsePublicBoxScoreHtml(`<section data-match-date="2026-09-05" data-opponent="Mayville State" data-home-away="away"></section><div data-team="us" data-kills="45" data-errors="18" data-attempts="110"></div><div data-team="opponent" data-kills="39" data-errors="22" data-attempts="115"></div>`, 'https://example.edu/box');
  const resolution = resolveCanonicalMatch({ evidence:{ date: box.match.date, opponentName: box.match.opponentName, homeAway: box.match.homeAway }, candidates:[{ id:'match-1', date:'2026-09-05', opponentNames:['Mayville State','Mayville State University'], homeAway:'away' }] });
  assert.equal(resolution.status, 'matched');
  assert.equal(resolution.matchId, 'match-1');

  const capabilities = detectCapabilities({ observations: box.observations });
  const team = Object.fromEntries(['us','opponent'].map(side => [side, Object.fromEntries(box.observations.filter(o => o.entityKey === side).map(o => [o.field, o.value]))]));
  const metrics = calculateMatchAnalytics({ matchId:'match-1', canonicalRevision:1, capabilities, teams:{ our_team:{ kills:team.us.kills, attackErrors:team.us.attack_errors, attackAttempts:team.us.attack_attempts }, opponent:{ kills:team.opponent.kills, attackErrors:team.opponent.attack_errors, attackAttempts:team.opponent.attack_attempts } } });
  const stored = metrics.map(m => ({ matchId:m.matchId, subject:m.subject, metric:m.metric, value:m.value, opportunities:m.denominator, engineVersion:m.engineVersion }));
  const query = resolveCoachQuestion('How did we hit against Mayville?', { matchId:'match-1' });
  assert.equal(query.status, 'resolved');
  const answer = executeAnalyticsQuery(query.query, stored);
  assert.equal(answer.status, 'answered');
  assert.deepEqual(answer.numbers, [27/110, 17/115]);
});

test('richer XML enriches capabilities for same canonical match without replacing basic evidence', () => {
  const basic = parsePublicBoxScoreHtml(`<section data-match-date="2026-09-05" data-opponent="Mayville State"></section><div data-team="us" data-kills="45" data-errors="18" data-attempts="110"></div><div data-team="opponent" data-kills="39" data-errors="22" data-attempts="115"></div>`, 'https://example.edu/box');
  const rich = parseStructuredXml(`<match date="2026-09-05" opponent="Mayville State"><rally index="1" servingTeam="us" scoreAfter="1-0" rotation="R1"/><contact player="p7" passQuality="3" attackOrigin="Outside" attackDestination="Cross"/></match>`, 'volleymetrics_xml', 'upload://vm.xml');
  const before = detectCapabilities({ observations: basic.observations });
  const after = detectCapabilities({ observations: [...basic.observations, ...rich.observations] });
  assert.equal(before.rallySequence, false);
  assert.equal(after.rallySequence, true);
  assert.equal(after.rotationState, true);
  assert.equal(after.contactQuality, true);
  assert.equal(after.attackOrigin, true);
  assert.equal(after.attackDestination, true);
  assert.equal(after.boxScoreTotals, true);
});
