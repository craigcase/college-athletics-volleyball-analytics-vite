import { getAdminClient } from '../../db/client.js';
import { assertNoError } from '../../db/supabase-utils.js';
import { getStoredMetrics } from '../../db/repositories/analytics.js';
import { resolveCoachQuestion } from '../../lib/coaches-edge/resolve.js';
import { executeAnalyticsQuery } from '../../lib/coaches-edge/execute.js';
import {
  formatCoachAnswer,
  insufficientEvidenceMessage,
  unsupportedQuestionMessage,
} from '../../lib/coaches-edge/presentation.js';
import { requireProgramContext } from './_shared/auth.js';
import { json, message, statusFor } from './_shared/http.js';

export default async (request: Request) => {
  try {
    const { program } = await requireProgramContext(request);
    const body = await request.json() as Record<string, unknown>;
    const matchId = String(body.matchId ?? '');
    const question = String(body.question ?? '').trim();
    if (!matchId || !question) return json({ error: 'Match and question are required.' }, 400);

    const db = getAdminClient();
    const match = await db
      .from('matches')
      .select('id,opponent_team_id')
      .eq('id', matchId)
      .eq('program_id', program.programId)
      .maybeSingle();
    assertNoError(match.error, 'Read Coach Edge match');
    if (!match.data) return json({ error: 'Match not found.' }, 404);

    let opponentName = 'Opponent';
    if ((match.data as any).opponent_team_id) {
      const team = await db
        .from('teams')
        .select('canonical_name')
        .eq('id', (match.data as any).opponent_team_id)
        .maybeSingle();
      assertNoError(team.error, 'Read Coach Edge opponent');
      opponentName = (team.data as any)?.canonical_name ?? opponentName;
    }

    const resolved = resolveCoachQuestion(question, { matchId, opponentNames: [opponentName] });
    const scope = `${program.seasonYear} • ${opponentName}`;

    if (resolved.status !== 'resolved') {
      let rotationState = false;
      if (resolved.reasonCode === 'requires_rotation') {
        const capability = await db
          .from('match_capabilities')
          .select('rotation_state')
          .eq('match_id', matchId)
          .maybeSingle();
        assertNoError(capability.error, 'Read Coach Edge match capabilities');
        rotationState = Boolean((capability.data as any)?.rotation_state);
      }
      return json({
        status: resolved.status,
        message: unsupportedQuestionMessage(resolved.reasonCode, { rotationState }),
        scope,
      });
    }

    const metrics = await getStoredMetrics(matchId);
    const answer = executeAnalyticsQuery(resolved.query, metrics);
    if (answer.status !== 'answered') {
      return json({
        status: 'insufficient_evidence',
        answer: insufficientEvidenceMessage(resolved.query),
        scope,
        evidence: answer.evidence,
      });
    }

    return json({
      status: 'answered',
      answer: formatCoachAnswer(resolved.query, answer.numbers, opponentName),
      scope,
      confidence: 'Evidence-backed • deterministic stored metric',
      evidence: answer.evidence,
    });
  } catch (error) {
    const detail = message(error, "Coach's Edge query failed.");
    return json({ error: detail }, statusFor(detail));
  }
};
