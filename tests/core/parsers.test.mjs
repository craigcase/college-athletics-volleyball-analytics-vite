import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterHtml } from '../../.core-dist/lib/ingestion/roster/sidearm.js';
import { parseScheduleHtml } from '../../.core-dist/lib/ingestion/schedule/sidearm.js';
import { parsePublicBoxScoreHtml } from '../../.core-dist/lib/ingestion/match/public-boxscore.js';

test('roster parser preserves supported player evidence and leaves missing fields missing', () => {
  const html = `<article class="sidearm-roster-player" data-player-id="11"><span class="sidearm-roster-player-name">Alex Smith</span><span class="sidearm-roster-player-jersey-number">7</span><span class="sidearm-roster-player-position">OH</span><span class="sidearm-roster-player-academic-year">So.</span><a class="sidearm-roster-player-name-link" href="/sports/womens-volleyball/roster/alex-smith/11">Alex Smith</a></article>`;
  const players = parseRosterHtml(html, 'https://example.edu/sports/womens-volleyball/roster');
  assert.deepEqual(players, [{ name: 'Alex Smith', number: '7', officialPosition: 'OH', classYear: 'So.', profileUrl: 'https://example.edu/sports/womens-volleyball/roster/alex-smith/11', sourcePlayerId: '11' }]);
});

test('schedule parser keeps neutral state and same-day matches distinct', () => {
  const html = `<li class="sidearm-schedule-game" data-date="2026-09-05" data-opponent="Mayville State" data-location="Jamestown, ND" data-neutral="true"></li><li class="sidearm-schedule-game" data-date="2026-09-05" data-opponent="Hastings" data-location="Jamestown, ND" data-neutral="true"></li>`;
  const matches = parseScheduleHtml(html, 'https://example.edu/sports/womens-volleyball/schedule/2026');
  assert.equal(matches.length, 2);
  assert.equal(matches[0].homeAway, 'neutral');
  assert.equal(matches[1].opponentName, 'Hastings');
});

test('public box score parser derives observations only from explicit data attributes', () => {
  const html = `<section data-match-date="2026-09-05" data-opponent="Mayville State" data-home-away="away"><div data-team="us" data-kills="45" data-errors="17" data-attempts="110" data-aces="6" data-service-errors="8"></div><div data-team="opponent" data-kills="38" data-errors="20" data-attempts="112"></div></section>`;
  const evidence = parsePublicBoxScoreHtml(html, 'https://example.edu/boxscore/123');
  assert.equal(evidence.match.date, '2026-09-05');
  assert.equal(evidence.observations.find(o => o.entityKey === 'us' && o.field === 'kills')?.value, 45);
  assert.equal(evidence.observations.some(o => o.field === 'passer_rating'), false);
});
