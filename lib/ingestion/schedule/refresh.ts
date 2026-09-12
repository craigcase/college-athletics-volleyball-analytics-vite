export type ScheduleRefreshState = {
  scheduledAt: string;
  homeAway: 'home' | 'away' | 'neutral' | 'unknown';
  location?: string | null;
  result?: string | null;
  setScoresJson?: string | null;
};

type EnrichableField = 'location' | 'result' | 'setScoresJson';
type ScheduleRefreshPlan =
  | { status: 'unchanged' }
  | { status: 'enrich'; patch: Partial<Pick<ScheduleRefreshState, EnrichableField>> }
  | { status: 'conflict'; conflictingFields: Array<keyof ScheduleRefreshState> };

const missing = (value: unknown) => value === null || value === undefined || value === '';

export function planScheduleRefresh(
  current: ScheduleRefreshState,
  incoming: ScheduleRefreshState,
): ScheduleRefreshPlan {
  const conflictingFields: Array<keyof ScheduleRefreshState> = [];
  const patch: Partial<Pick<ScheduleRefreshState, EnrichableField>> = {};

  if (current.scheduledAt !== incoming.scheduledAt) conflictingFields.push('scheduledAt');
  if (incoming.homeAway !== 'unknown' && current.homeAway !== 'unknown' && current.homeAway !== incoming.homeAway) {
    conflictingFields.push('homeAway');
  }

  for (const field of ['location', 'result', 'setScoresJson'] as const) {
    const currentValue = current[field];
    const incomingValue = incoming[field];
    if (missing(currentValue) && !missing(incomingValue)) patch[field] = incomingValue;
    else if (!missing(currentValue) && !missing(incomingValue) && currentValue !== incomingValue) {
      conflictingFields.push(field);
    }
  }

  if (conflictingFields.length) return { status: 'conflict', conflictingFields };
  if (Object.keys(patch).length) return { status: 'enrich', patch };
  return { status: 'unchanged' };
}
