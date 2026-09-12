import { getAdminClient } from '../client';
import { assertNoError } from '../supabase-utils';
import { id, nowIso } from '../../lib/ids';
import type { CurrentUser } from '../../lib/auth/current-user';
import type { ProgramSetupInput } from '../../lib/program/validation';

export type ProgramContext = {
  programId: string; seasonId: string; seasonYear: number; teamId: string;
  schoolAbbreviation: string; teamName: string; primaryColor: string; secondaryColor: string; accentColor: string;
  role: 'owner'|'staff'|'player';
};

type Membership = { program_id:string; role:'owner'|'staff'|'player' };

async function membershipForUser(user: CurrentUser | string): Promise<Membership | null> {
  const db=getAdminClient();
  if(typeof user!=='string' && user.id){
    const byId=await db.from('program_memberships').select('program_id,role').eq('user_external_id',user.id).eq('is_active',true).limit(1).maybeSingle();
    assertNoError(byId.error,'Read program membership');
    if(byId.data)return byId.data as Membership;
  }
  const email=typeof user==='string'?user:user.email;
  const byEmail=await db.from('program_memberships').select('program_id,role').ilike('user_email',email).eq('is_active',true).limit(1).maybeSingle();
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
  return {programId:p.id,seasonId:s.id,seasonYear:s.year,teamId:p.team_id,schoolAbbreviation:p.school_abbreviation,teamName:p.team_name,primaryColor:p.primary_color,secondaryColor:p.secondary_color,accentColor:p.accent_color,role:membership.role};
}

export async function createProgram(input: ProgramSetupInput, user: CurrentUser): Promise<ProgramContext> {
  const db=getAdminClient();
  if(await getActiveProgramForUser(user))throw new Error('ACTIVE_PROGRAM_EXISTS');
  const teamId=id('team'),programId=id('program'),seasonId=id('season'),now=nowIso();
  try{
    for(const [context,table,row] of [
      ['Create team','teams',{id:teamId,canonical_name:input.teamName,created_at:now}],
      ['Create team alias','team_aliases',{id:id('teamalias'),team_id:teamId,alias:input.teamName,source_family:'program_setup',created_at:now}],
      ['Create team season','team_seasons',{id:id('teamseason'),team_id:teamId,season_year:input.seasonYear,created_at:now}],
      ['Create program','programs',{id:programId,team_id:teamId,school_abbreviation:input.schoolAbbreviation,team_name:input.teamName,primary_color:input.primaryColor,secondary_color:input.secondaryColor,accent_color:input.accentColor,created_at:now}],
      ['Create season','seasons',{id:seasonId,program_id:programId,label:String(input.seasonYear),year:input.seasonYear,is_current:true,created_at:now}],
      ['Create owner membership','program_memberships',{id:id('membership'),program_id:programId,user_email:user.email,user_external_id:user.id,role:'owner',is_active:true,created_at:now}],
      ['Create activity event','activity_events',{id:id('activity'),program_id:programId,actor_email:user.email,action:'program.created',entity_type:'program',entity_id:programId,created_at:now}],
    ] as const){
      const result=await db.from(table).insert(row as any);
      assertNoError(result.error,context);
    }
  }catch(error){
    await db.from('programs').delete().eq('id',programId);
    await db.from('teams').delete().eq('id',teamId);
    throw error;
  }
  return {programId,seasonId,seasonYear:input.seasonYear,teamId,schoolAbbreviation:input.schoolAbbreviation,teamName:input.teamName,primaryColor:input.primaryColor,secondaryColor:input.secondaryColor,accentColor:input.accentColor,role:'owner'};
}
