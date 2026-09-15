import { getAdminClient, hasUserDbScope } from '../client.js';
import { assertNoError } from '../supabase-utils';
import { id, nowIso } from '../../lib/ids';
import type { CurrentUser } from '../../lib/auth/current-user';
import type { ProgramIdentityInput, ProgramSetupInput } from '../../lib/program/validation';

export type ProgramContext = {
  programId: string; seasonId: string; seasonYear: number; teamId: string;
  schoolName: string | null; schoolAbbreviation: string; teamName: string; primaryColor: string; secondaryColor: string; accentColor: string;
  role: 'owner'|'staff'|'player';
  canCorrectData: boolean;
};

type Membership = { program_id:string; role:'owner'|'staff'|'player'; can_correct_data?:boolean|null };

async function membershipForUser(user: CurrentUser | string): Promise<Membership | null> {
  const db=getAdminClient();
  if(typeof user!=='string' && user.id){
    const byId=await db.from('program_memberships').select('program_id,role,can_correct_data').eq('user_external_id',user.id).eq('is_active',true).limit(1).maybeSingle();
    assertNoError(byId.error,'Read program membership');
    if(byId.data)return byId.data as Membership;
  }
  const email=typeof user==='string'?user:user.email;
  const byEmail=await db.from('program_memberships').select('program_id,role,can_correct_data').ilike('user_email',email).eq('is_active',true).limit(1).maybeSingle();
  assertNoError(byEmail.error,'Read program membership');
  return (byEmail.data as Membership|null) ?? null;
}

export async function getActiveProgramForUser(user: CurrentUser | string): Promise<ProgramContext | null> {
  const db=getAdminClient();
  const membership=await membershipForUser(user);
  if(!membership)return null;
  const programResult=await db.from('programs').select('*').eq('id',membership.program_id).is('archived_at',null).maybeSingle();
  assertNoError(programResult.error,'Read program');
  const p=programResult.data as any;
  if(!p)return null;
  const seasonResult=await db.from('seasons').select('id,year').eq('program_id',p.id).eq('is_current',true).order('year',{ascending:false}).limit(1).maybeSingle();
  assertNoError(seasonResult.error,'Read active season');
  const s=seasonResult.data as any;
  if(!s)return null;
  return {programId:p.id,seasonId:s.id,seasonYear:s.year,teamId:p.team_id,schoolName:p.school_name??null,schoolAbbreviation:p.school_abbreviation,teamName:p.team_name,primaryColor:p.primary_color,secondaryColor:p.secondary_color,accentColor:p.accent_color,role:membership.role,canCorrectData:membership.role==='owner'||Boolean(membership.can_correct_data)};
}

export async function createProgram(input: ProgramSetupInput, user: CurrentUser): Promise<ProgramContext> {
  const db=getAdminClient();
  if(await getActiveProgramForUser(user))throw new Error('ACTIVE_PROGRAM_EXISTS');

  if (hasUserDbScope()) {
    const result = await db.rpc('create_volleyball_program', {
      p_school_name: input.schoolName,
      p_school_abbreviation: input.schoolAbbreviation,
      p_team_name: input.teamName,
      p_primary_color: input.primaryColor,
      p_secondary_color: input.secondaryColor,
      p_accent_color: input.accentColor,
      p_season_year: input.seasonYear,
    });
    if (result.error) {
      if (result.error.message?.includes('ACTIVE_PROGRAM_EXISTS')) throw new Error('ACTIVE_PROGRAM_EXISTS');
      assertNoError(result.error, 'Create program');
    }
    const row = result.data as Record<string, unknown> | null;
    if (!row) throw new Error('CREATE_PROGRAM_NO_RESULT');
    return {
      programId: String(row.programId),
      seasonId: String(row.seasonId),
      seasonYear: Number(row.seasonYear),
      teamId: String(row.teamId),
      schoolName: row.schoolName == null ? null : String(row.schoolName),
      schoolAbbreviation: String(row.schoolAbbreviation),
      teamName: String(row.teamName),
      primaryColor: String(row.primaryColor),
      secondaryColor: String(row.secondaryColor),
      accentColor: String(row.accentColor),
      role: 'owner',
      canCorrectData: true,
    };
  }

  const teamId=id('team'),programId=id('program'),seasonId=id('season'),now=nowIso();
  try{
    const setupRows: [string,string,Record<string,unknown>][] = [
      ['Create team','teams',{id:teamId,canonical_name:input.teamName,created_at:now}],
      ['Create team season','team_seasons',{id:id('teamseason'),team_id:teamId,season_year:input.seasonYear,created_at:now}],
      ['Create program','programs',{id:programId,team_id:teamId,school_name:input.schoolName,school_abbreviation:input.schoolAbbreviation,team_name:input.teamName,primary_color:input.primaryColor,secondary_color:input.secondaryColor,accent_color:input.accentColor,created_at:now}],
      ['Create season','seasons',{id:seasonId,program_id:programId,label:String(input.seasonYear),year:input.seasonYear,is_current:true,created_at:now}],
      ['Create owner membership','program_memberships',{id:id('membership'),program_id:programId,user_email:user.email,user_external_id:user.id,role:'owner',is_active:true,created_at:now}],
      ['Create activity event','activity_events',{id:id('activity'),program_id:programId,actor_email:user.email,action:'program.created',entity_type:'program',entity_id:programId,created_at:now}],
    ];
    for(const [context,table,row] of setupRows){
      const result=await db.from(table).insert(row as any);
      assertNoError(result.error,context);
    }
    for(const alias of [input.teamName,input.schoolAbbreviation,input.schoolName]){
      const result=await db.from('team_aliases').upsert({id:id('teamalias'),team_id:teamId,alias,source_family:'program_setup',created_at:now},{onConflict:'team_id,alias',ignoreDuplicates:true});
      assertNoError(result.error,'Create team alias');
    }
  }catch(error){
    await db.from('programs').delete().eq('id',programId);
    await db.from('teams').delete().eq('id',teamId);
    throw error;
  }
  return {programId,seasonId,seasonYear:input.seasonYear,teamId,schoolName:input.schoolName,schoolAbbreviation:input.schoolAbbreviation,teamName:input.teamName,primaryColor:input.primaryColor,secondaryColor:input.secondaryColor,accentColor:input.accentColor,role:'owner',canCorrectData:true};
}

export async function updateProgramIdentity(input: ProgramIdentityInput, user: CurrentUser): Promise<ProgramContext> {
  const db=getAdminClient();
  const current=await getActiveProgramForUser(user);
  if(!current)throw new Error('PROGRAM_NOT_FOUND');
  if(current.role!=='owner')throw new Error('PROGRAM_SETTINGS_FORBIDDEN');
  const now=nowIso();
  const programUpdate=await db.from('programs').update({
    school_name:input.schoolName,
    school_abbreviation:input.schoolAbbreviation,
    team_name:input.teamName,
    primary_color:input.primaryColor,
    secondary_color:input.secondaryColor,
    accent_color:input.accentColor,
  }).eq('id',current.programId);
  assertNoError(programUpdate.error,'Update program identity');
  const teamUpdate=await db.from('teams').update({canonical_name:input.teamName}).eq('id',current.teamId);
  assertNoError(teamUpdate.error,'Update program team identity');
  for(const alias of [input.teamName,input.schoolAbbreviation,input.schoolName]){
    const aliasWrite=await db.from('team_aliases').upsert({id:id('teamalias'),team_id:current.teamId,alias,source_family:'program_settings',created_at:now},{onConflict:'team_id,alias',ignoreDuplicates:true});
    assertNoError(aliasWrite.error,'Preserve program team alias');
  }
  const activity=await db.from('activity_events').insert({
    id:id('activity'),program_id:current.programId,actor_email:user.email,action:'program.identity_updated',entity_type:'program',entity_id:current.programId,
    details_json:JSON.stringify({schoolName:input.schoolName,schoolAbbreviation:input.schoolAbbreviation,teamName:input.teamName}),created_at:now,
  });
  assertNoError(activity.error,'Create program identity activity');
  const refreshed=await getActiveProgramForUser(user);
  if(!refreshed)throw new Error('PROGRAM_NOT_FOUND');
  return refreshed;
}
