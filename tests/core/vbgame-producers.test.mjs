import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const fixtureDir = path.resolve('tests/fixtures/v070/vcsu');
const names = [
  '08-21-26CSMGame.xml','08-21-26DordtGame.xml','08-22-26DakWesGame.xml','08-22-26MountMercyGame.xml',
  '08-28-26BenedictineCollegeGame.xml','08-28-26BenedictineMesaGame.xml','08-29-26GrandViewGame.xml',
  '09-2-26MayvilleGame.xml','09-4MontanaWesternGame.xml'
];

test('v0.7.0 fixture corpus contains seven PrestoSports and two LiveStats vbgame files', async () => {
  for (const name of names) assert.equal(existsSync(path.join(fixtureDir, name)), true, `missing ${name}`);
  const xmls = await Promise.all(names.map(name => readFile(path.join(fixtureDir, name), 'utf8')));
  assert.equal(xmls.filter(x => /source=["']PrestoSports["']/i.test(x)).length, 7);
  assert.equal(xmls.filter(x => /source=["']Volleyball LiveStats In-Arena Tool["']/i.test(x)).length, 2);
});

test('producer detection and V/H normalization use source metadata without trusting misleading venue orientation', async () => {
  const { detectVbgameProducer } = await import('../../.core-dist/lib/ingestion/match/vbgame/producer.js');
  const { readVbgameContext, classifyTerminalEvent } = await import('../../.core-dist/lib/ingestion/match/vbgame/common.js');
  const prestoXml = await readFile(path.join(fixtureDir, '08-21-26CSMGame.xml'), 'utf8');
  const liveStatsXml = await readFile(path.join(fixtureDir, '09-2-26MayvilleGame.xml'), 'utf8');

  assert.equal(detectVbgameProducer(prestoXml), 'presto_vbgame');
  assert.equal(detectVbgameProducer(liveStatsXml), 'livestats_vbgame');

  const presto = readVbgameContext(prestoXml, ['Valley City State', 'VCSU', 'VCS']);
  assert.equal(presto.opponentName, 'College of Saint Mary (NE)');
  assert.equal(presto.homeAway, 'neutral');
  assert.equal(presto.scoreOurVh, 'V');
  assert.deepEqual(presto.setFinalScores.at(-1), { setNumber: 4, score: { our: 16, opponent: 25 } });

  const mayville = readVbgameContext(liveStatsXml, ['Valley City State', 'Valley City', 'VC', 'VCSU']);
  assert.equal(mayville.opponentName.trim(), 'Mayville State');
  assert.equal(mayville.homeAway, 'away');
  assert.equal(mayville.scoreOurVh, 'H');
  assert.deepEqual(mayville.setFinalScores.at(-1), { setNumber: 4, score: { our: 25, opponent: 18 } });

  assert.equal(classifyTerminalEvent('[A] Service ace (Team).', 'our_team', 'our_team').type, 'service_ace');
  assert.equal(classifyTerminalEvent('[A] Service error.', 'opponent', 'our_team').type, 'service_error');
  assert.equal(classifyTerminalEvent('[A] Attack error by Hitter (block by Blocker).', 'our_team', 'opponent').type, 'stuff_block');
  assert.equal(classifyTerminalEvent('[A] Attack error by Hitter.', 'our_team', 'opponent').type, 'attack_error');
});
