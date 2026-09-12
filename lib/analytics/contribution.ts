export type ContributionInputs = {
  kills?: number;
  assistedKills?: number;
  unassistedKills?: number;
  attackErrors?: number;
  aces?: number;
  serviceErrors?: number;
  soloBlocks?: number;
  blockAssists?: number;
  settingErrors?: number;
  receptionErrors?: number;
  bhes?: number;
  directPointBlockingErrors?: number;
  digs?: number;
  fallbackPasses?: number;
};

const n = (value: number | undefined) => value ?? 0;

export function calculateContribution(input: ContributionInputs): number | null {
  const knownAttributedKills = n(input.assistedKills) + n(input.unassistedKills);
  if (n(input.kills) > 0 && knownAttributedKills === 0) return null;

  return (
    n(input.assistedKills) * 0.7 +
    n(input.unassistedKills) * 1 +
    n(input.attackErrors) * -1 +
    n(input.aces) * 1 +
    n(input.serviceErrors) * -1 +
    n(input.soloBlocks) * 1 +
    n(input.blockAssists) * 0.5 +
    n(input.settingErrors) * -1 +
    n(input.receptionErrors) * -1 +
    n(input.bhes) * -1 +
    n(input.directPointBlockingErrors) * -1 +
    n(input.digs) * 0.19 +
    n(input.fallbackPasses) * 0.27
  );
}
