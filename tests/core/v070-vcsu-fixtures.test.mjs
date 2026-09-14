import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseMatchSource } from '../../.core-dist/lib/ingestion/match/parse-source.js';
import { buildCanonicalTimeline } from '../../.core-dist/lib/ingestion/match/timeline-builder.js';
import { calculateRallyAnalytics } from '../../.core-dist/lib/analytics/rally.js';

const fixtureDir = 'tests/fixtures/v070/vcsu';
const ourTeamNames = ['Valley City State', 'Valley City', 'VCSU', 'VCS', 'VC'];

const fixtures = [
  { file: '08-21-26CSMGame.xml', producer: 'presto_vbgame', date: '2026-08-21', opponent: 'College of Saint Mary (NE)' },
  { file: '08-21-26DordtGame.xml', producer: 'presto_vbgame', date: '2026-08-21', opponent: 'Dordt (IA)' },
  { file: '08-22-26DakWesGame.xml', producer: 'presto_vbgame', date: '2026-08-22', opponent: 'Dakota Wesleyan (SD)' },
  { file: '08-22-26MountMercyGame.xml', producer: 'presto_vbgame', date: '2026-08-22', opponent: 'Mount Mercy' },
  { file: '08-28-26BenedictineCollegeGame.xml', producer: 'presto_vbgame', date: '2026-08-28', opponent: 'Benedictine (KS)' },
  { file: '08-28-26BenedictineMesaGame.xml', producer: 'presto_vbgame', date: '2026-08-28', opponent: 'Benedictine Mesa (AZ)' },
  { file: '08-29-26GrandViewGame.xml', producer: 'presto_vbgame', date: '2026-08-29', opponent: 'Grand View' },
  { file: '09-2-26MayvilleGame.xml', producer: 'livestats_vbgame', date: '2026-09-02', opponent: 'Mayville State' },
  { file: '09-4MontanaWesternGame.xml', producer: 'livestats_vbgame', date: '2026-09-04', opponent: 'Montana Western' },
];

async function parseFixture(fixture) {
  const text = await readFile(`${fixtureDir}/${fixture.file}`, 'utf8');
  const parsed = parseMatchSource({
    text,
    sourceFamily: 'official_xml',
    sourceUrl: `upload://${fixture.file}`,
    ourTeamNames,
  });
  assert.ok(parsed.timeline, `${fixture.file} should produce a scoring timeline`);
  return { parsed, canonical: buildCanonicalTimeline(parsed.timeline) };
}

function finalScoreBySet(canonical, setNumber) {
  const rows = canonical.rallies.filter(r => r.setNumber === setNumber);
  assert.ok(rows.length > 0, `set ${setNumber} should contain canonical rallies`);
  return rows.at(-1).scoreAfter;
}

function independentRallyPercentages(rallies, subject) {
  const opposite = side => side === 'our_team' ? 'opponent' : 'our_team';
  const sets = new Map();
  for (const rally of [...rallies].sort((a,b)=>a.setNumber-b.setNumber || a.rallyNumber-b.rallyNumber)) {
    const rows = sets.get(rally.setNumber) ?? [];
    rows.push(rally);
    sets.set(rally.setNumber, rows);
  }

  let sideoutN = 0, sideoutD = 0, psN = 0, psD = 0;
  let score1N = 0, score1D = 0, sos2N = 0, sos2D = 0, epoN = 0, epoD = 0;
  for (const rows of sets.values()) {
    for (let i = 0; i < rows.length; i += 1) {
      const rally = rows[i];
      if (rally.servingSide === subject) {
        psD += 1;
        if (rally.pointWinner === subject) psN += 1;
      } else if (rally.servingSide && opposite(rally.servingSide) === subject) {
        sideoutD += 1;
        if (rally.pointWinner === subject) sideoutN += 1;
      }

      if (rally.receivingSide === subject && rally.pointWinner === subject) {
        const first = rows[i + 1];
        if (first) {
          score1D += 1;
          if (first.pointWinner === subject) score1N += 1;
          if (first.pointWinner !== subject) {
            sos2D += 1;
          } else {
            const second = rows[i + 2];
            if (second) {
              sos2D += 1;
              if (second.pointWinner === subject) sos2N += 1;
            }
          }
        }
      }

      if (rally.pointWinner === subject && rally.attribution === 'given') {
        const next = rows[i + 1];
        if (next) {
          epoD += 1;
          if (next.pointWinner === subject) epoN += 1;
        }
      }
    }
  }
  return {
    sideout_percentage: [sideoutN, sideoutD],
    point_scored_percentage: [psN, psD],
    score1_percentage: [score1N, score1D],
    sos2_percentage: [sos2N, sos2D],
    epo_percentage: [epoN, epoD],
  };
}

test('all nine VCSU XML fixtures parse through the source router; final-score conflicts stay explicit instead of being invented away', async () => {
  for (const fixture of fixtures) {
    const { parsed, canonical } = await parseFixture(fixture);
    assert.equal(parsed.producer, fixture.producer, fixture.file);
    assert.equal(parsed.match.date, fixture.date, fixture.file);
    assert.equal(parsed.match.opponentName?.trim(), fixture.opponent, fixture.file);
    assert.ok(parsed.observations.some(o => o.field === 'kills'), `${fixture.file} should contain box-score totals`);
    assert.ok(parsed.timeline.setFinalScores.length >= 3, `${fixture.file} should contain set finals`);
    assert.ok(parsed.timeline.scoringRecords.length > 0, `${fixture.file} should contain scoring PBP`);

    const officialPointTotal = parsed.timeline.setFinalScores.reduce((sum, row) => sum + row.score.our + row.score.opponent, 0);
    assert.equal(canonical.rallies.length, officialPointTotal, `${fixture.file} canonical rally count`);
    assert.equal(canonical.setScoreIntegrity.length, parsed.timeline.setFinalScores.length, `${fixture.file} set integrity rows`);

    for (const final of parsed.timeline.setFinalScores) {
      const integrity = canonical.setScoreIntegrity.find(row => row.setNumber === final.setNumber);
      assert.ok(integrity, `${fixture.file} set ${final.setNumber} integrity`);
      assert.deepEqual(integrity.officialFinalScore, final.score, `${fixture.file} set ${final.setNumber} official final`);
      if (fixture.file === '08-22-26MountMercyGame.xml' && final.setNumber === 1) {
        assert.equal(integrity.status, 'conflict');
        assert.deepEqual(integrity.sourceFinalScore, { our: 28, opponent: 24 });
        assert.deepEqual(final.score, { our: 27, opponent: 25 });
        assert.deepEqual(finalScoreBySet(canonical, final.setNumber), { our: 28, opponent: 24 });
      } else {
        assert.equal(integrity.status, 'verified', `${fixture.file} set ${final.setNumber}`);
        assert.deepEqual(finalScoreBySet(canonical, final.setNumber), final.score, `${fixture.file} set ${final.setNumber} final`);
      }
    }
  }
});

test('known source gaps stay localized and never acquire invented volleyball detail', async () => {
  const mayville = await parseFixture(fixtures.find(f => f.file === '09-2-26MayvilleGame.xml'));
  assert.equal(mayville.parsed.timeline.scoringRecords.length, 193);
  assert.equal(mayville.canonical.rallies.length, 195);
  assert.equal(mayville.canonical.rallies.filter(r => r.evidenceStatus === 'gap_placeholder').length, 2);

  const csm = await parseFixture(fixtures.find(f => f.file === '08-21-26CSMGame.xml'));
  assert.equal(csm.canonical.rallies.filter(r => r.evidenceStatus === 'gap_placeholder').length, 1);

  for (const { canonical } of [mayville, csm]) {
    for (const gap of canonical.rallies.filter(r => r.evidenceStatus === 'gap_placeholder')) {
      assert.equal(gap.terminal, undefined);
      assert.equal(gap.serverSourceKey, undefined);
      assert.equal(gap.servingSide, 'our_team');
      assert.equal(gap.receivingSide, 'opponent');
      assert.equal(gap.pathway, 'unknown_phase');
      assert.equal(gap.attribution, 'unknown');
      assert.deepEqual(gap.sourceLinks, []);
    }
  }
});

test('every canonical set resets at 0-0 and every supported or placeholder rally advances exactly one point', async () => {
  for (const fixture of fixtures) {
    const { canonical } = await parseFixture(fixture);
    const seenSets = new Set();
    for (const rally of canonical.rallies) {
      if (!seenSets.has(rally.setNumber)) {
        assert.deepEqual(rally.scoreBefore, { our: 0, opponent: 0 }, `${fixture.file} set ${rally.setNumber} reset`);
        seenSets.add(rally.setNumber);
      }
      if (rally.evidenceStatus !== 'ambiguous') {
        const ourDelta = rally.scoreAfter.our - rally.scoreBefore.our;
        const opponentDelta = rally.scoreAfter.opponent - rally.scoreBefore.opponent;
        assert.equal(ourDelta + opponentDelta, 1, `${fixture.file} set ${rally.setNumber} rally ${rally.rallyNumber}`);
        assert.ok((ourDelta === 1 && opponentDelta === 0) || (ourDelta === 0 && opponentDelta === 1));
      }
    }
  }
});

test('Mayville deterministic rally analytics match an independent re-derivation and freeze evidence-supported baselines', async () => {
  const { canonical } = await parseFixture(fixtures.find(f => f.file === '09-2-26MayvilleGame.xml'));
  const actual = calculateRallyAnalytics({ matchId: 'mayville', canonicalRevision: 1, rallies: canonical.rallies });

  for (const subject of ['our_team', 'opponent']) {
    const independent = independentRallyPercentages(canonical.rallies, subject);
    for (const [code, [numerator, denominator]] of Object.entries(independent)) {
      const row = actual.find(metric => metric.subject === subject && metric.metric === code);
      assert.ok(row, `${subject} ${code} should be available`);
      assert.equal(row.numerator, numerator, `${subject} ${code} numerator`);
      assert.equal(row.denominator, denominator, `${subject} ${code} denominator`);
    }
  }

  const pick = (subject, metric) => {
    const row = actual.find(x => x.subject === subject && x.metric === metric);
    return [row?.numerator, row?.denominator];
  };
  assert.deepEqual(pick('our_team', 'sideout_percentage'), [49, 94]);
  assert.deepEqual(pick('our_team', 'point_scored_percentage'), [53, 101]);
  assert.deepEqual(pick('our_team', 'score1_percentage'), [23, 47]);
  assert.deepEqual(pick('our_team', 'sos2_percentage'), [13, 47]);
  assert.deepEqual(pick('our_team', 'epo_percentage'), [20, 39]);
  assert.deepEqual(pick('opponent', 'sideout_percentage'), [48, 101]);
  assert.deepEqual(pick('opponent', 'point_scored_percentage'), [45, 94]);
  assert.deepEqual(pick('opponent', 'score1_percentage'), [21, 47]);
  assert.deepEqual(pick('opponent', 'sos2_percentage'), [12, 47]);
  assert.deepEqual(pick('opponent', 'epo_percentage'), [9, 28]);
});


test('Mount Mercy score conflict suppresses match-level rally analytics rather than silently using a bad set', async () => {
  const { canonical } = await parseFixture(fixtures.find(f => f.file === '08-22-26MountMercyGame.xml'));
  assert.equal(canonical.setScoreIntegrity.filter(row => row.status === 'conflict').length, 1);
  const metrics = calculateRallyAnalytics({
    matchId: 'mount-mercy',
    canonicalRevision: 1,
    rallies: canonical.rallies,
    setScoreIntegrity: canonical.setScoreIntegrity,
  });
  assert.deepEqual(metrics, []);
});
