export type HittingInputs = { kills: number; errors: number; attempts: number };

export function calculateHittingPercentage({ kills, errors, attempts }: HittingInputs): number | null {
  if (!Number.isFinite(kills) || !Number.isFinite(errors) || !Number.isFinite(attempts) || attempts <= 0) return null;
  return (kills - errors) / attempts;
}
