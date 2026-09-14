export type ProgramIdentityInput = {
  schoolName: string;
  schoolAbbreviation: string;
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};
export type ProgramSetupInput = ProgramIdentityInput & {
  seasonYear: number;
};
export type ProgramIdentityValidation = { ok: true; value: ProgramIdentityInput } | { ok: false; errors: string[] };
export type ProgramValidation = { ok: true; value: ProgramSetupInput } | { ok: false; errors: string[] };
const HEX = /^#[0-9a-f]{6}$/i;

function validateIdentity(input: unknown): ProgramIdentityValidation {
  if (!input || typeof input !== 'object') return { ok:false, errors:['Program identity is required.'] };
  const candidate = input as Record<string, unknown>;
  const values: ProgramIdentityInput = {
    schoolName: typeof candidate.schoolName === 'string' ? candidate.schoolName : '',
    schoolAbbreviation: typeof candidate.schoolAbbreviation === 'string' ? candidate.schoolAbbreviation : '',
    teamName: typeof candidate.teamName === 'string' ? candidate.teamName : '',
    primaryColor: typeof candidate.primaryColor === 'string' ? candidate.primaryColor : '',
    secondaryColor: typeof candidate.secondaryColor === 'string' ? candidate.secondaryColor : '',
    accentColor: typeof candidate.accentColor === 'string' ? candidate.accentColor : '',
  };
  const errors: string[] = [];
  const schoolName = values.schoolName.trim();
  const schoolAbbreviation = values.schoolAbbreviation.trim().toUpperCase();
  const teamName = values.teamName.trim().toUpperCase();
  if (!schoolName || schoolName.length > 160) errors.push('Full university name is required and must be 160 characters or fewer.');
  if (!schoolAbbreviation || schoolAbbreviation.length > 12) errors.push('School abbreviation is required and must be 12 characters or fewer.');
  if (!teamName || teamName.length > 80) errors.push('Mascot / team name is required and must be 80 characters or fewer.');
  for (const [label, value] of [['Primary',values.primaryColor],['Secondary',values.secondaryColor],['Accent',values.accentColor]] as const) if (!HEX.test(value)) errors.push(`${label} color must be a six-digit hex color.`);
  if (errors.length) return { ok:false, errors };
  return { ok:true, value:{ ...values, schoolName, schoolAbbreviation, teamName } };
}

export function validateProgramIdentityUpdate(input: unknown): ProgramIdentityValidation {
  return validateIdentity(input);
}

export function validateProgramSetup(input: unknown): ProgramValidation {
  const identity = validateIdentity(input);
  if (identity.ok === false) return { ok:false, errors: identity.errors };
  const candidate = input as Record<string, unknown>;
  const seasonYear = typeof candidate.seasonYear === 'number' ? candidate.seasonYear : Number.NaN;
  if (!Number.isInteger(seasonYear) || seasonYear < 2000 || seasonYear > 2100) return { ok:false, errors:['Season year is invalid.'] };
  return { ok:true, value:{ ...identity.value, seasonYear } };
}
