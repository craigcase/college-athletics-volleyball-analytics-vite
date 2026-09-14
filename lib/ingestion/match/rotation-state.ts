import type { CanonicalRallyDraft, TeamSide } from './timeline-types.js';

export type RotationObservation = {
  setNumber: number;
  rallyNumber: number;
  teamSide: TeamSide;
  cycleSlot?: 1|2|3|4|5|6;
  rotationNumber?: 1|2|3|4|5|6;
  method: 'source_reported'|'rule_derived'|'coach_confirmed'|'provisional'|'unknown';
  confidence: number;
  serverSourceKey?: string;
};

type Slot = 1|2|3|4|5|6;
type TeamCycleState = {
  serverToSlot: Map<string, Slot>;
  lastServiceSlot?: Slot;
  currentSlot?: Slot;
  currentServer?: string;
};

const nextSlot = (slot: Slot): Slot => (slot === 6 ? 1 : (slot + 1) as Slot);

export function deriveServingCycle(rallies: CanonicalRallyDraft[]): RotationObservation[] {
  const out: RotationObservation[] = [];
  const bySet = new Map<number, CanonicalRallyDraft[]>();
  for (const rally of rallies) {
    const rows = bySet.get(rally.setNumber) ?? [];
    rows.push(rally);
    bySet.set(rally.setNumber, rows);
  }

  for (const [setNumber, setRallies] of [...bySet.entries()].sort((a,b) => a[0]-b[0])) {
    const states: Record<TeamSide, TeamCycleState> = {
      our_team: { serverToSlot: new Map() },
      opponent: { serverToSlot: new Map() },
    };
    let previousKnownServingSide: TeamSide | undefined;

    for (const rally of [...setRallies].sort((a,b) => a.rallyNumber-b.rallyNumber)) {
      const side = rally.servingSide;
      if (!side || rally.evidenceStatus === 'ambiguous') {
        previousKnownServingSide = undefined;
        continue;
      }
      const state = states[side];
      const server = rally.serverSourceKey;
      const acquisition = previousKnownServingSide !== side;
      let slot: Slot | undefined;

      if (server && state.serverToSlot.has(server)) {
        slot = state.serverToSlot.get(server);
        state.currentSlot = slot;
        state.currentServer = server;
        if (acquisition) state.lastServiceSlot = slot;
      } else if (acquisition) {
        slot = state.lastServiceSlot ? nextSlot(state.lastServiceSlot) : 1;
        if (server) state.serverToSlot.set(server, slot);
        state.lastServiceSlot = slot;
        state.currentSlot = slot;
        state.currentServer = server;
      } else {
        slot = state.currentSlot;
        if (server && slot) state.serverToSlot.set(server, slot);
        if (server) state.currentServer = server;
      }

      out.push({
        setNumber,
        rallyNumber: rally.rallyNumber,
        teamSide: side,
        ...(slot ? { cycleSlot: slot } : {}),
        method: slot ? 'rule_derived' : 'unknown',
        confidence: slot ? (server ? 0.92 : 0.75) : 0,
        ...(server ? { serverSourceKey: server } : {}),
      });
      previousKnownServingSide = side;
    }
  }

  return out;
}
