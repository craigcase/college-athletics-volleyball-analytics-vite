import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('tests/fixtures/v070/public/mayville-pbp.html', 'utf8');

test('public Sidearm parser preserves box totals and emits set-grouped play by play', async () => {
  const { parsePublicBoxScoreHtml } = await import('../../.core-dist/lib/ingestion/match/public-boxscore.js');
  const parsed = parsePublicBoxScoreHtml(html, 'https://vcsuvikings.com/sports/womens-volleyball/stats/2026/mayville-state-university/boxscore/6523', { ourTeamNames: ['Valley City State','Valley City','VCSU','VC'] });
  assert.equal(parsed.producer, 'public_sidearm');
  assert.equal(parsed.match.opponentName, 'Mayville State');
  assert.equal(parsed.observations.find(o => o.entityKey === 'us' && o.field === 'kills')?.value, 51);
  assert.equal(parsed.timeline.scoringRecords.length, 5);
  assert.deepEqual(parsed.timeline.setFinalScores, [
    { setNumber: 1, score: { our: 2, opponent: 1 } },
    { setNumber: 2, score: { our: 1, opponent: 1 } },
  ]);
  assert.equal(parsed.timeline.scoringRecords[0].setNumber, 1);
  assert.equal(parsed.timeline.scoringRecords[0].servingSide, 'opponent');
  assert.equal(parsed.timeline.scoringRecords[0].pointWinner, 'our_team');
  assert.deepEqual(parsed.timeline.scoringRecords[0].scoreAfter, { our: 1, opponent: 0 });
  assert.equal(parsed.timeline.timelineEvents.filter(e => e.type === 'timeout').length, 1);
  assert.equal(parsed.timeline.scoringRecords.at(-1).setNumber, 2);
});

test('public Sidearm parser captures set attack totals and player match totals from standard tables', async () => {
  const { parsePublicBoxScoreHtml } = await import('../../.core-dist/lib/ingestion/match/public-boxscore.js');
  const richHtml = `
    <html><head><title>Volleyball vs Benedictine College (Kan.) on 8/28/2026 - Box Score - Valley City State University</title></head><body>
      <table>
        <tr><th>Set</th><th colspan="4">Valley City State</th><th colspan="4">Benedictine (KS)</th></tr>
        <tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr>
        <tr><td>1</td><td>10</td><td>3</td><td>29</td><td>.241</td><td>11</td><td>7</td><td>30</td><td>.133</td></tr>
        <tr><td>2</td><td>16</td><td>8</td><td>41</td><td>.195</td><td>15</td><td>3</td><td>33</td><td>.364</td></tr>
        <tr><td>Total</td><td>54</td><td>25</td><td>152</td><td>.191</td><td>51</td><td>20</td><td>146</td><td>.212</td></tr>
      </table>
      <table>
        <tr><th>#</th><th>Player</th><th>SP</th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>A</th><th>E</th><th>SA</th><th>SE</th><th>SA-SE</th><th>BS</th><th>BA</th><th>BE</th><th>DIG</th><th>BHE</th><th>RE</th><th>Pts</th></tr>
        <tr><td>10</td><td><a href="/sports/volleyball/roster/mady-geist/999">Mady Geist</a></td><td>4</td><td>13</td><td>7</td><td>27</td><td>.222</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0-0</td><td>1</td><td>1</td><td>1</td><td>1</td><td>0</td><td>0</td><td>14.5</td></tr>
        <tr><td>22</td><td>Madden Bogenreif</td><td>4</td><td>1</td><td>1</td><td>6</td><td>.000</td><td>18</td><td>0</td><td>3</td><td>2</td><td>3-2</td><td>0</td><td>0</td><td>0</td><td>6</td><td>0</td><td>0</td><td>4.0</td></tr>
      </table>
      <table>
        <tr><th>#</th><th>Player</th><th>SP</th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>A</th><th>E</th><th>SA</th><th>SE</th><th>SA-SE</th><th>BS</th><th>BA</th><th>BE</th><th>DIG</th><th>BHE</th><th>RE</th><th>Pts</th></tr>
        <tr><td>06</td><td>Barbara Terra</td><td>4</td><td>13</td><td>5</td><td>32</td><td>.250</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0-0</td><td>0</td><td>3</td><td>0</td><td>1</td><td>0</td><td>0</td><td>14.5</td></tr>
      </table>
    </body></html>`;
  const parsed = parsePublicBoxScoreHtml(richHtml, 'https://vcsuvikings.com/sports/volleyball/stats/2026/benedictine-college-kan-/boxscore/6521', { ourTeamNames: ['Valley City State','VCSU'] });
  const set1Kills = parsed.observations.find(o => o.entityType === 'set' && o.entityKey === 'us:set:1' && o.field === 'kills');
  assert.equal(set1Kills?.value, 10);
  assert.equal(parsed.observations.find(o => o.entityType === 'set' && o.entityKey === 'opponent:set:2' && o.field === 'attack_attempts')?.value, 33);
  assert.equal(parsed.observations.find(o => o.entityType === 'player' && o.entityKey === 'us:player:Mady Geist' && o.field === 'kills')?.value, 13);
  assert.equal(parsed.observations.find(o => o.entityType === 'player' && o.entityKey === 'us:player:Madden Bogenreif' && o.field === 'assists')?.value, 18);
  assert.equal(parsed.observations.find(o => o.entityType === 'player' && o.entityKey === 'opponent:player:Barbara Terra' && o.field === 'attack_attempts')?.value, 32);
});

test('public Sidearm timeline preserves non-scoring lineup events and explicit secondary terminal attribution', async () => {
  const { parsePublicBoxScoreHtml } = await import('../../.core-dist/lib/ingestion/match/public-boxscore.js');
  const richHtml = `
    <html><head><title>Volleyball vs Benedictine College (Kan.) on 8/28/2026 - Box Score - Valley City State University</title></head><body>
      <table><tr><th>Set</th><th colspan="4">Valley City State</th><th colspan="4">Benedictine (KS)</th></tr><tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr><tr><td>Total</td><td>2</td><td>0</td><td>2</td><td>1.000</td><td>0</td><td>1</td><td>1</td><td>-1.000</td></tr></table>
      <table>
        <tr><th>Serve</th><th>Score</th><th>VC</th><th>BEN</th><th>Play Description</th></tr>
        <tr><td></td><td></td><td></td><td></td><td>On court for VALLEY C: Mady Geist; Madden Bogenreif; Brynn Sorenson; Hudson Zerface; Molly Bjornbey; Eden Carrier.</td></tr>
        <tr><td>VC</td><td></td><td></td><td></td><td>VALLEY C subs: Kadie Kocka.</td></tr>
        <tr><td>VC</td><td>1-0</td><td></td><td></td><td>[Madden Bogenreif] Service ace (Kelly DeMeulenaere).</td></tr>
        <tr><td>VC</td><td>2-0</td><td></td><td></td><td>[Madden Bogenreif] Kill by Mady Geist (from Gracie Schumacher), block error by Allison Kuebelbeck.</td></tr>
        <tr><td>BEN</td><td>2-1</td><td></td><td></td><td>[Ava Penuel] Bad set by Gracie Schumacher.</td></tr>
      </table>
    </body></html>`;
  const parsed = parsePublicBoxScoreHtml(richHtml, 'https://vcsuvikings.com/boxscore/6521', { ourTeamNames: ['Valley City State','VCSU','VALLEY C','VC'] });
  assert.equal(parsed.timeline?.timelineEvents.some(e => e.type === 'starter_announcement' && e.teamSide === 'our_team'), true);
  assert.equal(parsed.timeline?.timelineEvents.some(e => e.type === 'substitution' && e.teamSide === 'our_team'), true);
  const ace = parsed.timeline?.scoringRecords[0]?.terminal;
  assert.equal(ace?.type, 'service_ace');
  assert.equal(ace?.receiverSourceKey, 'Kelly DeMeulenaere');
  const kill = parsed.timeline?.scoringRecords[1]?.terminal;
  assert.equal(kill?.type, 'kill');
  assert.deepEqual(kill?.assistSourceKeys, ['Gracie Schumacher']);
  assert.equal(kill?.relatedEvents?.[0]?.type, 'blocking_error');
  assert.equal(kill?.relatedEvents?.[0]?.playerSourceKey, 'Allison Kuebelbeck');
  assert.equal(parsed.timeline?.scoringRecords[2]?.terminal?.type, 'setting_error');
});


test('public Sidearm parser merges table enrichment even when structured team observations already exist', async () => {
  const { parsePublicBoxScoreHtml } = await import('../../.core-dist/lib/ingestion/match/public-boxscore.js');
  const mixedHtml = `
    <html><head><title>Volleyball vs Benedictine College (Kan.) on 8/28/2026 - Box Score - Valley City State University</title></head><body>
      <div data-team="us" data-kills="54"></div>
      <table>
        <tr><th>Set</th><th colspan="4">Valley City State</th><th colspan="4">Benedictine (KS)</th></tr>
        <tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr>
        <tr><td>1</td><td>10</td><td>3</td><td>29</td><td>.241</td><td>11</td><td>7</td><td>30</td><td>.133</td></tr>
        <tr><td>Total</td><td>54</td><td>25</td><td>152</td><td>.191</td><td>51</td><td>20</td><td>146</td><td>.212</td></tr>
      </table>
      <table>
        <tr><th>#</th><th>Player</th><th>SP</th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>A</th><th>E</th><th>SA</th><th>SE</th><th>SA-SE</th><th>BS</th><th>BA</th><th>BE</th><th>DIG</th><th>BHE</th><th>RE</th><th>Pts</th></tr>
        <tr><td>10</td><td>Mady Geist</td><td>4</td><td>13</td><td>7</td><td>27</td><td>.222</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0-0</td><td>1</td><td>1</td><td>1</td><td>1</td><td>0</td><td>0</td><td>14.5</td></tr>
      </table>
    </body></html>`;
  const parsed = parsePublicBoxScoreHtml(mixedHtml, 'https://vcsuvikings.com/boxscore/6521', { ourTeamNames: ['Valley City State','VCSU'] });
  assert.equal(parsed.observations.filter(o => o.entityType === 'team' && o.entityKey === 'us' && o.field === 'kills').length, 1);
  assert.equal(parsed.observations.find(o => o.entityType === 'set' && o.entityKey === 'us:set:1' && o.field === 'attack_attempts')?.value, 29);
  assert.equal(parsed.observations.find(o => o.entityType === 'player' && o.entityKey === 'us:player:Mady Geist' && o.field === 'kills')?.value, 13);
});

test('public Sidearm parser tolerates title rows before the live PBP header and Set # labels', async () => {
  const { parsePublicBoxScoreHtml } = await import('../../.core-dist/lib/ingestion/match/public-boxscore.js');
  const liveShapeHtml = `
    <html><head><title>Volleyball vs Grand View University (IA) on 8/29/2026 - Box Score - Valley City State University</title></head><body>
      <table>
        <tr><th>Set</th><th colspan="4">Valley City State</th><th colspan="4">Grand View University (IA)</th></tr>
        <tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr>
        <tr><td>Set #1</td><td>9</td><td>7</td><td>35</td><td>.057</td><td>12</td><td>4</td><td>31</td><td>.258</td></tr>
        <tr><td>Total</td><td>43</td><td>30</td><td>145</td><td>.090</td><td>52</td><td>16</td><td>138</td><td>.261</td></tr>
      </table>
      <table>
        <tr><th colspan="5">Set #1</th></tr>
        <tr><th>Serve</th><th>Score</th><th>VCSU</th><th>GRAND VI</th><th>Play Description</th></tr>
        <tr><td>GRAND VI</td><td>0-1</td><td></td><td></td><td>[Grand View Server] Kill by Grand View Hitter.</td></tr>
        <tr><td>VCSU</td><td>1-1</td><td></td><td></td><td>[VCSU Server] Kill by VCSU Hitter.</td></tr>
      </table>
      <table>
        <tr><th colspan="5">Set #2</th></tr>
        <tr><th>Serve</th><th>Score</th><th>VCSU</th><th>GRAND VI</th><th>Play Description</th></tr>
        <tr><td>VCSU</td><td>1-0</td><td></td><td></td><td>[VCSU Server] Service ace.</td></tr>
      </table>
    </body></html>`;
  const parsed = parsePublicBoxScoreHtml(liveShapeHtml, 'https://vcsuvikings.com/sports/volleyball/stats/2026/grand-view-university-iowa-/boxscore/6522', { ourTeamNames: ['Valley City State','VCSU','VALLEY C','VC'] });
  assert.equal(parsed.observations.find(o => o.entityType === 'set' && o.entityKey === 'us:set:1' && o.field === 'kills')?.value, 9);
  assert.equal(parsed.timeline?.scoringRecords.length, 3);
  assert.equal(parsed.timeline?.scoringRecords[0]?.setNumber, 1);
  assert.equal(parsed.timeline?.scoringRecords[2]?.setNumber, 2);
  assert.deepEqual(parsed.timeline?.setFinalScores, [
    { setNumber: 1, score: { our: 1, opponent: 1 } },
    { setNumber: 2, score: { our: 1, opponent: 0 } },
  ]);
});

test('public Sidearm parser reads live two-sided scoreboard PBP and repeated set headers in one table', async () => {
  const { parsePublicBoxScoreHtml } = await import('../../.core-dist/lib/ingestion/match/public-boxscore.js');
  const liveHtml = `
    <html><head><title>Volleyball vs Grand View University (IA) on 8/29/2026 - Box Score - Valley City State University</title></head><body>
      <table>
        <tr><th>Set</th><th colspan="4">Grand View</th><th colspan="4">Valley City State</th></tr>
        <tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr>
        <tr><td>Total</td><td>52</td><td>16</td><td>138</td><td>.261</td><td>43</td><td>30</td><td>145</td><td>.090</td></tr>
      </table>
      <table>
        <tr><th colspan="6">Set #1</th></tr>
        <tr><th>Serve</th><th>GRAND VI</th><th>Visiting Team Score</th><th>Scoring Team Logo</th><th>Home Team Score</th><th>VALLEY C</th></tr>
        <tr><td>VALLEY C</td><td>[Madden Bogenreif] Kill by Brooklyn Roder.</td><td>1</td><td></td><td>0</td><td></td></tr>
        <tr><td>GRAND VI</td><td></td><td>1</td><td></td><td>1</td><td>[Victoria Gasparini] Service error.</td></tr>
        <tr><td>--</td><td>Timeout Grand View.</td><td></td><td></td><td></td><td></td></tr>
        <tr><th colspan="6">Set #2</th></tr>
        <tr><th>Serve</th><th>GRAND VI</th><th>Visiting Team Score</th><th>Scoring Team Logo</th><th>Home Team Score</th><th>VALLEY C</th></tr>
        <tr><td>GRAND VI</td><td></td><td>0</td><td></td><td>1</td><td>[Ava Renner] Service error.</td></tr>
        <tr><td>VALLEY C</td><td>[Gracie Schumacher] Kill by Victoria Gasparini.</td><td>1</td><td></td><td>1</td><td></td></tr>
      </table>
    </body></html>`;
  const parsed = parsePublicBoxScoreHtml(liveHtml, 'https://vcsuvikings.com/sports/volleyball/stats/2026/grand-view-university-ia-/boxscore/6522', { ourTeamNames: ['Valley City State','VCSU','VALLEY C','VC'] });
  assert.equal(parsed.timeline?.scoringRecords.length, 4);
  assert.deepEqual(parsed.timeline?.scoringRecords.map(r => [r.setNumber, r.pointWinner, r.scoreAfter.our, r.scoreAfter.opponent]), [
    [1, 'opponent', 0, 1],
    [1, 'our_team', 1, 1],
    [2, 'our_team', 1, 0],
    [2, 'opponent', 1, 1],
  ]);
  assert.equal(parsed.timeline?.timelineEvents.some(e => e.setNumber === 1 && e.type === 'timeout' && e.teamSide === 'opponent'), true);
  assert.deepEqual(parsed.timeline?.setFinalScores, [
    { setNumber: 1, score: { our: 1, opponent: 1 } },
    { setNumber: 2, score: { our: 1, opponent: 1 } },
  ]);
});

test('public Sidearm split scoreboard reads the scoring-side description when our team is the visitor', async () => {
  const { parsePublicBoxScoreHtml } = await import('../../.core-dist/lib/ingestion/match/public-boxscore.js');
  const html = `
    <html><head><title>Volleyball vs Example Opponent on 9/1/2026 - Box Score - Valley City State University</title></head><body>
      <table>
        <tr><th>Set</th><th colspan="4">Valley City State</th><th colspan="4">Example Opponent</th></tr>
        <tr><th></th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>K</th><th>E</th><th>TA</th><th>Pct</th></tr>
        <tr><td>Total</td><td>1</td><td>0</td><td>1</td><td>1.000</td><td>0</td><td>0</td><td>0</td><td>.000</td></tr>
      </table>
      <table>
        <tr><th>Serve</th><th>VALLEY C</th><th>Visiting Team Score</th><th>Scoring Team Logo</th><th>Home Team Score</th><th>EXAMPLE</th></tr>
        <tr><td>VALLEY C</td><td>[VCSU Server] Service ace (Opponent Receiver).</td><td>1</td><td></td><td>0</td><td></td></tr>
      </table>
    </body></html>`;
  const parsed = parsePublicBoxScoreHtml(html, 'https://vcsuvikings.com/boxscore/9999', { ourTeamNames: ['Valley City State','VCSU','VALLEY C'] });
  assert.equal(parsed.timeline?.scoringRecords.length, 1);
  assert.equal(parsed.timeline?.scoringRecords[0]?.pointWinner, 'our_team');
  assert.equal(parsed.timeline?.scoringRecords[0]?.terminal?.type, 'service_ace');
  assert.equal(parsed.timeline?.scoringRecords[0]?.serverSourceKey, 'VCSU Server');
});
