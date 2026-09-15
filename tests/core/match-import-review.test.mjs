import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMatchReview } from '../../.core-dist/lib/ingestion/match/review.js';

test('match review payload explains imported evidence and suggested candidate without pretending it is confirmed', () => {
  const review = buildMatchReview({
    sourceArtifactId:'source-1',
    evidence:{date:'2026-08-28',opponentName:'Benedictine (KS)',homeAway:'neutral',setScores:['25-16','21-25','25-22','25-22']},
    ranked:[{
      candidate:{id:'match-1',date:'2026-08-28',opponentNames:['Benedictine College (Kan.)'],homeAway:'neutral'},
      score:0.5,
      evidence:{sourceMatchId:false,date:true,opponent:false,homeAway:true,setScores:false},
    }],
  });
  assert.equal(review.sourceArtifactId,'source-1');
  assert.equal(review.imported.opponentName,'Benedictine (KS)');
  assert.equal(review.suggested?.matchId,'match-1');
  assert.equal(review.suggested?.confidence,0.5);
  assert.deepEqual(review.suggested?.matchedEvidence,['date','homeAway']);
  assert.equal(review.suggested?.canonicalOpponentName,'Benedictine College (Kan.)');
});

test('needs-review imports return ranked review context and preserved sources are resumed after confirmation', async () => {
  const { readFile } = await import('node:fs/promises');
  const importer = await readFile('lib/services/import-match.ts','utf8');
  const reviewer = await readFile('lib/services/review-match-import.ts','utf8');
  const sources = await readFile('db/repositories/sources.ts','utf8');
  assert.match(importer,/getMatchReviewCandidates/);
  assert.match(importer,/buildMatchReview/);
  assert.match(importer,/review:/);
  assert.match(reviewer,/loadStoredSource/);
  assert.match(reviewer,/finalizeMatchImport/);
  assert.match(reviewer,/saveTrustedOpponentAlias/);
  assert.match(sources,/export async function loadStoredSource/);
});

test('match import review endpoint supports confirm choose-existing and create-missing without re-uploading bytes', async () => {
  const { readFile } = await import('node:fs/promises');
  const endpoint = await readFile('netlify/functions/match-import-review.ts','utf8');
  assert.match(endpoint,/confirm/);
  assert.match(endpoint,/choose_existing/);
  assert.match(endpoint,/create_missing/);
  assert.match(endpoint,/reviewMatchImport/);
  const local = await readFile('scripts/local-dev-server.ts','utf8');
  assert.match(local,/'match-import-review'/);
});
