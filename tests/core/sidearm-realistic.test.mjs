import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterHtml } from '../../.core-dist/lib/ingestion/roster/sidearm.js';
import { parseScheduleHtml } from '../../.core-dist/lib/ingestion/schedule/sidearm.js';

test('roster adapter reads common nested Sidearm markup and profile href', () => {
  const html=`<li class="sidearm-roster-player"><div class="sidearm-roster-player-name"><h3><a href="/sports/womens-volleyball/roster/ava-geist/123">Ava Geist</a></h3></div><span class="sidearm-roster-player-jersey-number">7</span><span class="sidearm-roster-player-position">OH</span><span class="sidearm-roster-player-academic-year">So.</span></li>`;
  const rows=parseRosterHtml(html,'https://example.edu/sports/womens-volleyball/roster');
  assert.equal(rows[0].name,'Ava Geist');
  assert.equal(rows[0].profileUrl,'https://example.edu/sports/womens-volleyball/roster/ava-geist/123');
});

test('roster adapter reads the linked athlete name, exact player card, lazy image, and decoded attributes from VCSU markup', () => {
  const html=`
    <div class="sidearm-roster-players-container">
      <li class="sidearm-roster-player-container">Not a player</li>
      <li class="sidearm-roster-player" data-player-id="5452" data-player-url="/sports/volleyball/roster/brynn-sorenson/5452">
        <div class="sidearm-roster-player-name">
          <span class="sidearm-roster-player-jersey"><span class="sidearm-roster-player-jersey-number">1</span></span>
          <h3><a href="/sports/volleyball/roster/brynn-sorenson/5452">Brynn Sorenson</a></h3>
        </div>
        <span class="sidearm-roster-player-position">OH</span>
        <span class="sidearm-roster-player-height">5&#39;8&quot;</span>
        <img class="lazyload" src="data:image/gif;base64,placeholder" data-src="/images/2026/7/1/Brynn.jpg?width=80&amp;quality=90" alt="Brynn Sorenson - View Profile">
      </li>
    </div>`;
  const rows=parseRosterHtml(html,'https://vcsuvikings.com/sports/volleyball/roster');
  assert.equal(rows.length,1);
  assert.equal(rows[0].name,'Brynn Sorenson');
  assert.equal(rows[0].number,'1');
  assert.equal(rows[0].height,'5\'8"');
  assert.equal(rows[0].sourcePlayerId,'5452');
  assert.equal(rows[0].imageUrl,'https://vcsuvikings.com/images/2026/7/1/Brynn.jpg?width=80&quality=90');
});

test('schedule adapter reads common nested Sidearm markup with ISO datetime when explicit data attributes are absent', () => {
  const html=`<li class="sidearm-schedule-game"><time datetime="2026-09-05T19:00:00-05:00">Sep 5</time><div class="sidearm-schedule-game-opponent-name"><a href="/sports/womens-volleyball/opponent/mayville-state/12">Mayville State</a></div><div class="sidearm-schedule-game-location">Valley City, ND</div><div class="sidearm-schedule-game-result">W, 3-1</div><a class="sidearm-schedule-game-boxscore" href="/sports/womens-volleyball/stats/2026/mayville/boxscore/42">Box Score</a></li>`;
  const rows=parseScheduleHtml(html,'https://example.edu/sports/womens-volleyball/schedule/2026');
  assert.equal(rows.length,1);
  assert.equal(rows[0].date,'2026-09-05T19:00:00-05:00');
  assert.equal(rows[0].opponentName,'Mayville State');
  assert.equal(rows[0].location,'Valley City, ND');
  assert.equal(rows[0].result,'W, 3-1');
  assert.equal(rows[0].boxScoreUrl,'https://example.edu/sports/womens-volleyball/stats/2026/mayville/boxscore/42');
});

test('schedule adapter derives the season year and reads VCSU visible date, game id, neutral site, complete result, and box score', () => {
  const html=`
    <title>2026 Volleyball Schedule - Valley City State University</title>
    <li class="sidearm-schedule-game sidearm-schedule-neutral-game sidearm-schedule-game-completed" data-game-id="6517">
      <div class="sidearm-schedule-game-opponent-date"><span>Aug 21 (Fri)</span><span>4:00 PM</span></div>
      <div class="sidearm-schedule-game-opponent-name"><a href="https://www.csmflames.com">College of Saint Mary (Neb.)</a></div>
      <div class="sidearm-schedule-game-location"><span>Sioux City, Iowa</span></div>
      <div class="sidearm-schedule-game-result"><span>L,</span><span>1-3</span></div>
      <ul><li class="sidearm-schedule-game-links-boxscore"><a href="/sports/volleyball/stats/2026/college-of-saint-mary-neb-/boxscore/6517">Box Score</a></li></ul>
    </li>`;
  const rows=parseScheduleHtml(html,'https://vcsuvikings.com/sports/volleyball/schedule');
  assert.equal(rows.length,1);
  assert.deepEqual(rows[0],{
    date:'2026-08-21T16:00:00',
    opponentName:'College of Saint Mary (Neb.)',
    homeAway:'neutral',
    location:'Sioux City, Iowa',
    result:'L, 1-3',
    sourceMatchId:'6517',
    boxScoreUrl:'https://vcsuvikings.com/sports/volleyball/stats/2026/college-of-saint-mary-neb-/boxscore/6517',
  });
});

test('schedule adapter keeps reading VCSU location and result after nested box-score list items', () => {
  const html=`
    <title>2026 Volleyball Schedule - Valley City State University</title>
    <li class="sidearm-schedule-game sidearm-schedule-neutral-game" data-game-id="6516">
      <div class="sidearm-schedule-game-opponent-date"><span>Aug 21 (Fri)</span><span>10:00 AM</span></div>
      <div class="sidearm-schedule-game-opponent-name"><a href="https://www.dordt.edu">Dordt University (Iowa)</a></div>
      <div class="sidearm-schedule-game-links"><ul><li class="sidearm-schedule-game-links-boxscore"><a href="/boxscore/6516">Box Score</a></li></ul></div>
      <div class="sidearm-schedule-game-location"><span>Sioux City, Iowa</span></div>
      <div class="sidearm-schedule-game-result"><span></span><span>L,</span><span>0-3</span></div>
    </li>`;
  const [match]=parseScheduleHtml(html,'https://vcsuvikings.com/sports/volleyball/schedule');
  assert.equal(match.location,'Sioux City, Iowa');
  assert.equal(match.result,'L, 0-3');
});

import { parsePublicBoxScoreHtml } from '../../.core-dist/lib/ingestion/match/public-boxscore.js';

test('public box score adapter reads Sidearm-style team total rows without source-specific data attributes', () => {
  const html=`
    <html><head><title>Volleyball vs Viterbo on 8/22/2026 - Box Score - Mayville State University Athletics</title></head><body>
      <h2>Game Statistics By Set</h2>
      <table>
        <tr><th>Set</th><th colspan="4">Mayville State</th><th colspan="4">Viterbo</th></tr>
        <tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr>
        <tr><td>1</td><td>10</td><td>9</td><td>35</td><td>.029</td><td>13</td><td>6</td><td>32</td><td>.219</td></tr>
        <tr><td>Total</td><td>27</td><td>27</td><td>112</td><td>.000</td><td>36</td><td>11</td><td>98</td><td>.255</td></tr>
      </table>
      <h2>Team Statistical Comparison</h2>
      <table>
        <tr><th></th><th>Mayville State</th><th>Viterbo</th></tr>
        <tr><td>Kills</td><td>27</td><td>36</td></tr>
        <tr><td>Aces</td><td>4</td><td>7</td></tr>
        <tr><td>Service Errors</td><td>6</td><td>9</td></tr>
        <tr><td>Blocks</td><td>2</td><td>8</td></tr>
        <tr><td>Assists</td><td>25</td><td>35</td></tr>
        <tr><td>Digs</td><td>45</td><td>49</td></tr>
      </table>
    </body></html>`;
  const evidence=parsePublicBoxScoreHtml(html,'https://msucomets.com/boxscore/5422',{ourTeamNames:['Mayville State','MSU']});
  assert.equal(evidence.match.date,'2026-08-22');
  assert.equal(evidence.match.opponentName,'Viterbo');
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='kills')?.value,27);
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='attack_errors')?.value,27);
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='attack_attempts')?.value,112);
  assert.equal(evidence.observations.find(o=>o.entityKey==='opponent'&&o.field==='attack_attempts')?.value,98);
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='aces')?.value,4);
  assert.equal(evidence.observations.find(o=>o.entityKey==='opponent'&&o.field==='digs')?.value,49);
});

test('public box score adapter links a VCSU Sidearm page by game id and recognizes the official-site team name', () => {
  const html=`
    <html><head><title>Volleyball vs College of Saint Mary (Neb.) on 8/21/2026 - Box Score - Valley City State University</title></head><body>
      <table>
        <tr><th>Set</th><th colspan="4">Valley City State</th><th colspan="4">College of Saint Mary (NE)</th></tr>
        <tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr>
        <tr><td>Total</td><td>29</td><td>32</td><td>123</td><td>-.024</td><td>49</td><td>26</td><td>130</td><td>.177</td></tr>
      </table>
    </body></html>`;
  const evidence=parsePublicBoxScoreHtml(
    html,
    'https://vcsuvikings.com/sports/volleyball/stats/2026/college-of-saint-mary-neb-/boxscore/6517',
    {ourTeamNames:['VCSU','VIKINGS']},
  );
  assert.equal(evidence.match.sourceMatchId,'6517');
  assert.equal(evidence.match.opponentName,'College of Saint Mary (Neb.)');
  assert.equal(evidence.observations.find(o=>o.entityKey==='us'&&o.field==='kills')?.value,29);
  assert.equal(evidence.observations.find(o=>o.entityKey==='opponent'&&o.field==='attack_attempts')?.value,130);
});

test('canonical season context outranks a misleading page year for visible Sidearm dates', () => {
  const html=`<title>2099 Volleyball Schedule</title><li class="sidearm-schedule-game" data-game-id="season-context"><div class="sidearm-schedule-game-opponent-date">Aug 21 (Fri)</div><div class="sidearm-schedule-game-opponent-name">Test Opponent</div></li>`;
  const rows=parseScheduleHtml(html,'https://example.edu/sports/volleyball/schedule',2026);
  assert.equal(rows.length,1);
  assert.equal(rows[0].date,'2026-08-21');
});
