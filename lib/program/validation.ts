export type ProgramSetupInput = {
  schoolAbbreviation: string;
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  seasonYear: number;
};
export type ProgramValidation = { ok: true; value: ProgramSetupInput } | { ok: false; errors: string[] };
const HEX = /^#[0-9a-f]{6}$/i;

export function validateProgramSetup(input: unknown): ProgramValidation {
  if (!input || typeof input !== 'object') return { ok:false, errors:['Program identity is required.'] };
  const candidate = input as Record<string, unknown>;
  const values: ProgramSetupInput = {
    schoolAbbreviation: typeof candidate.schoolAbbreviation === 'string' ? candidate.schoolAbbreviation : '',
    teamName: typeof candidate.teamName === 'string' ? candidate.teamName : '',
    primaryColor: typeof candidate.primaryColor === 'string' ? candidate.primaryColor : '',
    secondaryColor: typeof candidate.secondaryColor === 'string' ? candidate.secondaryColor : '',
    accentColor: typeof candidate.accentColor === 'string' ? candidate.accentColor : '',
    seasonYear: typeof candidate.seasonYear === 'number' ? candidate.seasonYear : Number.NaN,
  };
  const errors: string[] = [];
  const schoolAbbreviation = values.schoolAbbreviation.trim().toUpperCase();
  const teamName = values.teamName.trim();
  if (!schoolAbbreviation || schoolAbbreviation.length > 12) errors.push('School abbreviation is required and must be 12 characters or fewer.');
  if (!teamName || teamName.length > 80) errors.push('Mascot / team name is required and must be 80 characters or fewer.');
  for (const [label, value] of [['Primary',values.primaryColor],['Secondary',values.secondaryColor],['Accent',values.accentColor]] as const) if (!HEX.test(value)) errors.push(`${label} color must be a six-digit hex color.`);
  if (!Number.isInteger(values.seasonYear) || values.seasonYear < 2000 || values.seasonYear > 2100) errors.push('Season year is invalid.');
  if (errors.length) return { ok:false, errors };
  return { ok:true, value:{ ...values, schoolAbbreviation, teamName } };
}
